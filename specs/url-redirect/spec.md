# Spec — url-redirect

## Summary

`GET /r/{id}` — unauthenticated 302 redirect to the target URL stored in SQLite, with scan counter increment. `PATCH /api/qr/{id}` — authenticated endpoint for the owner to edit the target URL without regenerating the QR image (QR always encodes `/r/{id}`).

Scope: redirect routing, scan counter, and target URL editing. History display and pagination is `qr-history`. Public QR page (`/q/{id}`) is `public-qr-page`.

---

## User Stories

**US1 — Redirect**
Given a QR code of type `url` exists and the user scans it,
When the scanner's HTTP client requests `GET /r/{id}`,
Then the server responds with HTTP 302 and `Location` header set to the stored target URL,
And the scan counter for that QR code is incremented by 1.

**US2 — Edit target URL**
Given the authenticated owner views their QR code in the history,
When they submit `PATCH /api/qr/{id}` with a new valid URL,
Then the target URL is updated in the DB,
And the next scan of the same QR image redirects to the new URL.

---

## Acceptance Criteria

### Redirect endpoint

AC1. `GET /r/{id}` for a known URL-type QR code → HTTP 302 with `Location: {content}` (the stored target URL).

AC2. `GET /r/{id}` responds in < 100ms (DB lookup + redirect only; no auth check, no MinIO call, no session lookup).

AC3. `GET /r/{id}` for an unknown `id` → HTTP 404.

AC4. `GET /r/{id}` for a QR code of `contentType = 'text'` → HTTP 404 (no redirect — text QRs do not encode `/r/{id}`).

AC5. `GET /r/{id}` for a soft-deleted QR code (if soft-delete ever added) — out of scope for v1; hard delete per CLAUDE.md non-negotiable #8 means → 404.

AC6. Scan counter is incremented on every successful redirect (AC1). Counter increment is best-effort: a DB write failure must not prevent the 302 from being sent.

AC7. The redirect endpoint has no auth guard (`@Public()` decorator). No cookie or token is checked.

### Edit target URL

AC8. `PATCH /api/qr/{id}` with body `{ content: "<valid-url>" }` by the owner → HTTP 200 with updated QR metadata response (same shape as `POST /api/qr`).

AC9. `PATCH /api/qr/{id}` for a `contentType = 'text'` QR → HTTP 422 (unprocessable — text QRs are static, no redirect link to update).

AC10. `PATCH /api/qr/{id}` by a non-owner or for unknown id → HTTP 404.

AC11. `PATCH /api/qr/{id}` without auth → HTTP 401.

AC12. `content` in PATCH body must be a valid `http://` or `https://` URL; invalid value → HTTP 400.

AC13. `PATCH /api/qr/{id}` does NOT regenerate the QR image (PNG/SVG in MinIO remain unchanged). Only `content` column updated in `qr_codes`.

### Scan counter

AC14. `GET /api/qr/{id}` (owner metadata endpoint, from `qr-generate`) returns the current `scanCount` in its response.

AC15. `POST /api/qr` creates QR with `scanCount = 0`.

AC16. `scanCount` is stored as a column on `qr_codes` table (integer, default 0, not null).

---

## Out of Scope

- Scan analytics (timestamps, user-agent, geolocation) — v2+
- Batch edit of target URLs
- URL expiration — `link-expiration` feature
- `GET /r/{id}` for text-type serving the text content as a page — out of scope; text QRs are static and their image encodes the text directly

---

## Edge Cases

E1. `id` contains path-traversal characters (e.g. `../etc/passwd`) → 404 (no match in DB; no filesystem access).

E2. `id` is valid UUID format but not in DB → 404.

E3. `id` is in DB but target `content` is empty string — cannot happen (created via validated DTO with non-empty URL) but if it occurs, redirect should still issue 302 with empty `Location` rather than 500. (Belt-and-suspenders; the DTO guard is sufficient.)

E4. `PATCH` with same URL as current → no-op DB write acceptable; still returns 200 with current state.

E5. Concurrent scans of the same `id` → counter increments may race in SQLite WAL mode. Acceptable: `UPDATE qr_codes SET scan_count = scan_count + 1` is atomic per SQLite single-writer; race is not possible with better-sqlite3 synchronous driver, but TypeORM async path needs a raw increment query, not read-modify-write.

E6. `GET /r/{id}` target URL is an HTTP (non-HTTPS) URL → still redirect; validation of target scheme is at write time (PATCH/POST), not at redirect time.

---

## Open Questions

*(none — all resolved)*

---

## Grill Log

| Branch | Question | Resolution | Date |
|---|---|---|---|
| OQ1 | Scan counter: column on `qr_codes` vs. separate `scans` table? | **Column on `qr_codes`** — PRD says "compteur basique v1"; separate table adds migration cost with no v1 benefit | 2026-07-19 |
| OQ2 | Increment timing: sync vs. async fire-and-forget? | **Async fire-and-forget** — 302 sent immediately, UPDATE runs in background; best-effort per AC6; guarantees < 100ms | 2026-07-19 |
| OQ3 | `scanCount` in `GET /api/qr/:id` metadata? | **Yes** — AC14 already states this; additive change to `qr.controller.ts` response + `QrCode` entity | 2026-07-19 |
