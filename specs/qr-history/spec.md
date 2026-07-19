# Spec — qr-history

## Summary

Paginated list of all QR codes created by the authenticated user, with aperçu thumbnail, creation date, truncated content, and scan count. Individual delete that removes both DB record and MinIO files (PNG + SVG). Auto-save on generation is already handled by `qr-generate` (every QR is persisted on creation). This feature adds the list + delete endpoints.

---

## User Stories

**US1 — List history**
Given the user is authenticated,
When they request `GET /api/qr?page=1&limit=20`,
Then they receive a paginated list of their QR codes (newest first), each item containing: id, contentType, content (truncated to 80 chars), size, fgColor, bgColor, errorCorrection, scanCount, createdAt, pngUrl, svgUrl.

**US2 — Delete QR code**
Given the user is authenticated and owns the QR code,
When they request `DELETE /api/qr/{id}`,
Then the DB record is removed, the MinIO files (`qr/{id}/qr.png` and `qr/{id}/qr.svg`) are deleted, and any subsequent `GET /r/{id}` or `GET /api/qr/{id}/png` returns 404.

---

## Acceptance Criteria

### List endpoint

AC1. `GET /api/qr` (authenticated) → 200 with paginated response: `{ items: QrItem[], total: number, page: number, limit: number }`.

AC2. Items ordered by `createdAt DESC` (newest first).

AC3. Default pagination: `page=1`, `limit=20`. Both params optional in query string.

AC4. `page` must be ≥ 1; `limit` must be between 1 and 100. Invalid values → 400.

AC5. List returns only QR codes belonging to the authenticated user (filtered by `userId`).

AC6. `GET /api/qr` without auth → 401.

AC7. Empty history → 200 with `{ items: [], total: 0, page: 1, limit: 20 }`.

AC8. `content` field in list items is truncated to 80 characters (trailing `…` if truncated). Truncation done server-side in the response, original content preserved in DB.

### Delete endpoint

AC9. `DELETE /api/qr/{id}` by owner → 204 No Content.

AC10. After delete: `GET /api/qr/{id}` (owner metadata) → 404.

AC11. After delete: `GET /api/qr/{id}/png` (public proxy) → 404.

AC12. After delete: MinIO objects `qr/{id}/qr.png` and `qr/{id}/qr.svg` are removed.

AC13. `DELETE /api/qr/{id}` for unknown id or non-owner → 404.

AC14. `DELETE /api/qr/{id}` without auth → 401.

AC15. MinIO delete failure must NOT prevent DB record deletion — DB delete always completes. MinIO cleanup is best-effort (log error if it fails, still return 204).

AC16. `DELETE /api/qr/{id}` for a `contentType = 'text'` QR (no MinIO files might be expected) — MinIO delete is attempted for both keys regardless of contentType; errors are swallowed per AC15.

AC17. After delete: `GET /r/{id}` (public redirect) → 404. `RedirectUseCase` calls `findById` → null → NotFoundException.

### Delete operation order

AC18. Delete operation sequence: (1) attempt MinIO parallel delete of both keys — errors swallowed, logged; (2) DB record delete — always executed, errors propagate. MinIO-first ensures orphaned files are preferred over a broken DB entry that points to missing files. DB delete always wins regardless of MinIO outcome.

---

## Out of Scope

- Bulk delete
- Sorting by fields other than `createdAt`
- Filtering by contentType or content search
- Restoring deleted QR codes (CLAUDE.md non-negotiable #8: deleted → 404, no tombstone)
- Pagination via cursor/infinite scroll (PRD: "pagination classique par pages")

---

## Edge Cases

E1. Page beyond last page (e.g. `page=99` when only 3 items) → 200 with `{ items: [], total: 3, page: 99, limit: 20 }` (not 404).

E2. Delete QR whose MinIO files already don't exist (partial upload, prior failed cleanup) → still delete DB record, swallow MinIO errors, return 204.

E3. Concurrent delete of same QR by same user → first succeeds (204), second returns 404.

E4. `limit=0` → 400 (below minimum of 1).

E5. QR code with content exactly 80 chars → no truncation, no trailing `…`.

E6. QR code with content of 81+ chars → truncated to 80 chars + `…`.

---

## Open Questions

*(none — all resolved)*

---

## Grill Log

| Branch | Question | Resolution | Date |
|---|---|---|---|
| OQ1 | MinIO delete: parallel vs sequential? | **Parallel** — `Promise.all([delete png, delete svg])`, no ordering constraint | 2026-07-19 |
| OQ2 | `QrStoragePort` delete method: `delete(id)` vs `deletePng/deleteSvg`? | **`delete(id)` unique** — encapsulates two-key structure; use case shouldn't know file layout | 2026-07-19 |
| OQ3 | Content truncation: controller vs domain? | **Controller `toResponse()`** — pure presentation concern, no domain invariant | 2026-07-19 |
| Gap | Delete operation order (MinIO vs DB)? | **MinIO first (best-effort), DB second (mandatory)** — orphaned files preferred over broken DB entries | 2026-07-19 |
| Gap | `GET /r/{id}` after delete → 404? | **Yes, AC17 added** — `RedirectUseCase.findById` returns null → NotFoundException | 2026-07-19 |
| Gap | `QrRepository.findByUserId` not in current interface? | New method `findAllByUserId(userId, page, limit)` needed — to be designed in /plan | 2026-07-19 |
