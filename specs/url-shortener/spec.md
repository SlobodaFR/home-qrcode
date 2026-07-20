# Spec — url-shortener

## Summary

Standalone short link creation: generates a `/r/{id}` redirect without producing a QR image. The link is tracked (scan counter), editable (target URL changeable), deletable, and appears in the dashboard in a dedicated "Liens courts" section. Intended for email, SMS, and other plain-text use cases where a QR image is unnecessary.

## User Stories

**US1 — Create a short link**
Given I am authenticated,
When I submit a target URL via the short link form,
Then a new `/r/{id}` redirect is created (no PNG/SVG generated),
And the short link `{FRONTEND_URL}/r/{id}` is displayed immediately,
And the link appears in the "Liens courts" section.

**US2 — Short link redirect**
Given a short link exists at `/r/{id}`,
When anyone visits that URL (unauthenticated),
Then they receive a 302 redirect to the target URL,
And the scan counter increments.

**US3 — Edit short link target**
Given I own a short link,
When I change the target URL,
Then all subsequent visits to `/r/{id}` redirect to the new URL.

**US4 — Delete short link**
Given I own a short link,
When I delete it,
Then `/r/{id}` returns 404,
And the link disappears from the dashboard.

**US5 — Scan counter**
Given a short link exists,
When it is visited N times,
Then the dashboard shows scan count = N.

## Acceptance Criteria

### AC1 — `POST /api/links` creates a short link
- Given an authenticated user posts `{ url: string }` with a valid http/https URL,
  Then a new record is inserted in `qr_codes` with `source = 'shortlink'`, `contentType = 'url'`, `content = url`, UUID id,
  And sentinel values are stored for QR-only fields (`size = 0`, `fgColor = ''`, `bgColor = ''`, `errorCorrection = 'M'`),
  And response is 201 with `{ id, url, shortUrl, scanCount: 0, createdAt }`.
- `shortUrl` = `{FRONTEND_URL}/r/{id}` — computed from config, not stored.
- No QR image generated, no MinIO upload.
- Given `url` is missing or not a valid `http`/`https` URL, response is 400.

### AC2 — `GET /api/links` returns short link list
- Given an authenticated user calls `GET /api/links`,
  Then response is 200 with `{ items, total, page, limit }`,
  Where each item is `{ id, url, shortUrl, scanCount, createdAt }`,
  Ordered by `createdAt` DESC.
- Only records owned by the caller with `source = 'shortlink'` are returned.
- `GET /api/qr` excludes shortlinks (`source = 'shortlink'` rows never appear in QR list).
  - Backward compat: existing rows where `source IS NULL` are treated as QR codes.

### AC3 — `/r/{id}` redirect works for short links
- Given a short link exists at `/r/{id}`,
  When an unauthenticated request arrives,
  Then the existing `RedirectController` returns 302 to the target URL.
- `RedirectUseCase` and `QrRepository.findById` are unchanged — shortlinks share the same table.
- Scan counter increments on each hit (same path as QR redirects).
- Given the short link does not exist or was deleted, response is 404.

### AC4 — Edit target URL
- `PATCH /api/links/:id` (authenticated, owner only) accepts `{ url: string }`,
  validates it as a valid `http`/`https` URL,
  Then updates `content` in DB and returns 200 with updated `ShortLinkItem`.
- `EditShortLinkUseCase` checks `source = 'shortlink'` and `userId = owner` — returns 404 if either fails.
  - This is a separate use case from `EditTargetUrlUseCase` to prevent cross-entity edits.
- Given non-owner or missing id, response is 404.

### AC5 — Delete
- `DELETE /api/links/:id` (authenticated, owner only) calls `DeleteShortLinkUseCase`,
  which deletes the DB row only — no MinIO call.
- Response: 204.
- Given non-owner or missing id, response is 404.

### AC6 — Dashboard UI: short links section
- Dashboard has a dedicated "Liens courts" section below the QR section.
- Form: single URL `<input>` + "Créer" button.
- Each item shows: short URL (with "Copier" clipboard button), target URL (truncated), scan count, edit button, delete button.
- Clicking "Copier" copies `shortUrl` to clipboard via `navigator.clipboard.writeText`.
- Edit button opens an inline URL input to submit PATCH.
- Delete button removes the item from the list.

### AC7 — No MinIO dependency
- `CreateShortLinkUseCase` does not call any method on `QrStoragePort`.
- `DeleteShortLinkUseCase` does not call any method on `QrStoragePort`.

## Out of Scope

- Expiration (`expires_at`) — that is `link-expiration` (#10).
- QR code generation from a short link ("promote to QR").
- Analytics beyond total scan count (no per-scan timestamps, geo, user-agent).
- Custom slugs (always UUID-based).
- Bulk creation.

## Edge Cases

### EC1 — URL validation
- Empty string → 400.
- Non-URL string (e.g. `hello world`) → 400.
- `http://` and `https://` both accepted. Other schemes (`ftp:`, `javascript:`, etc.) → 400.
- Enforced via `@IsUrl({ protocols: ['http', 'https'], require_protocol: true })` (class-validator) at HTTP boundary only.

### EC2 — Redirect collision with QR codes
- `/r/{id}` lookup resolves from the same `qr_codes` table. UUID v4 collision negligible; no dedup needed at creation time.

### EC3 — Concurrent edit + redirect
- Last PATCH wins. No locking required.

### EC4 — Delete during active traffic
- After delete, subsequent `/r/{id}` hits return 404. In-flight requests that already read the URL before delete complete normally.

### EC5 — Very long target URL
- No enforced max length beyond SQLite TEXT. Frontend truncates display only.

### EC6 — `source` backward compatibility
- Column added as nullable. Existing rows with `source IS NULL` are treated as `'qr'` in all list queries.
- Migration: `ALTER TABLE qr_codes ADD COLUMN source TEXT DEFAULT NULL`.
- `ListQrUseCase` filter: `source IS NULL OR source != 'shortlink'`.
- `ListLinksUseCase` filter: `source = 'shortlink'`.

### EC7 — Cross-entity edit prevention
- `PATCH /api/qr/:id` (EditTargetUrlUseCase) checks `source != 'shortlink'` — returns 404 for shortlink ids.
- `PATCH /api/links/:id` (EditShortLinkUseCase) checks `source = 'shortlink'` — returns 404 for QR ids.

## Grill Log

| # | Question | Resolution |
|---|---|---|
| OQ1 | Same table or separate? | Same `qr_codes` table + new `source: 'qr' \| 'shortlink'` nullable column. Shared redirect/scan-counter logic unchanged. |
| OQ2 | API namespace | `POST /api/links` — new `LinksController`. Clean separation; QR namespace stays QR-only. |
| OQ3 | Dashboard placement | Separate "Liens courts" section below QR list (not mixed). |
| OQ4 | Redirect controller lookup | `RedirectController` / `QrRepository.findById` unchanged — shortlinks in same table, same lookup path. |
| OQ5 | `shortUrl` stored or computed? | Computed from `FRONTEND_URL` at response time, never persisted (same pattern as `pngUrl`/`svgUrl`). |
| IQ1 | QR-only fields for shortlinks | Sentinel values: `size=0, fgColor='', bgColor='', errorCorrection='M'`. Never exposed in `/api/links` response. |
| IQ2 | `GET /api/qr` backward compat | Filter: `source IS NULL OR source != 'shortlink'`. NULL rows = legacy QR codes. |
| IQ3 | Cross-entity edit prevention | `EditShortLinkUseCase` (source=shortlink check) + update `EditTargetUrlUseCase` to also check `source != 'shortlink'`. |
| IQ4 | Delete + MinIO for shortlinks | `DeleteShortLinkUseCase` — DB-only delete, no `storage.delete` call. Satisfies AC7 without `Promise.allSettled` noise. |
| IQ5 | URL validation implementation | `@IsUrl({ protocols: ['http', 'https'], require_protocol: true })` from class-validator, applied to both POST and PATCH DTOs. |
