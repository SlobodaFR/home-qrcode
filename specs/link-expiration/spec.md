# Spec — link-expiration

## Summary

Optional `expires_at` timestamp on URL redirects (both URL-type QR codes and short links). After expiry, `GET /r/{id}` returns 410 Gone instead of 302. Expiration is set at creation or updated via a dedicated PATCH endpoint; it can be cleared (set to null) to restore the redirect. Non-URL content types are out of scope (they have no redirect path).

## User Stories

**US1 — Create with expiration**
Given I am authenticated,
When I create a URL QR code or short link and include an optional `expiresAt` date (`YYYY-MM-DD`),
Then the record is stored with expiry = end-of-day UTC (`2026-08-25T23:59:59.000Z`),
And the response includes `expiresAt: string | null`,
And the dashboard shows the expiry date next to the item.

**US2 — Expired redirect**
Given a redirect exists with `expiresAt` in the past (server UTC clock),
When anyone visits `/r/{id}` (authenticated or not),
Then they receive **410 Gone**,
And the scan counter is NOT incremented.

**US3 — Active redirect unchanged**
Given a redirect exists with `expiresAt` in the future, or `expiresAt` is null,
When anyone visits `/r/{id}`,
Then they receive the normal 302 redirect and the scan counter increments.

**US4 — Set / update expiration**
Given I own a URL QR code or short link,
When I call `PATCH /api/qr/:id/expiration` or `PATCH /api/links/:id/expiration` with `{ expiresAt: "YYYY-MM-DD" }`,
Then the record's `expires_at` is updated to end-of-day UTC,
And subsequent `/r/{id}` visits reflect the new expiry immediately.

**US5 — Clear expiration**
Given I own a redirect with `expiresAt` set,
When I call `PATCH /api/qr/:id/expiration` or `PATCH /api/links/:id/expiration` with `{ expiresAt: null }`,
Then `expires_at` is set to NULL,
And `/r/{id}` returns 302 again.

## Acceptance Criteria

### AC1 — Data model
- Given the app starts with an existing database,
  Then `qr_codes` gains a nullable `expires_at` column (`DATETIME`, UTC, nullable).
- Given an existing row with no `expires_at`,
  Then it defaults to `NULL` (never expires — backward compatible with all existing QR codes and shortlinks).

### AC2 — `GET /r/{id}` expiry check in `RedirectUseCase`
- Given `findById` returns a record where `expiresAt` is non-null and `expiresAt <= serverNow (UTC)`,
  When `RedirectUseCase.execute()` is called,
  Then it throws `GoneException` (HTTP 410).
- Given `findById` returns a record where `expiresAt` is null,
  When `RedirectUseCase.execute()` is called,
  Then it proceeds to 302 redirect and increments scan counter (unchanged behavior).
- Given `findById` returns a record where `expiresAt` is in the future,
  When `RedirectUseCase.execute()` is called,
  Then it proceeds to 302 redirect and increments scan counter (unchanged behavior).
- `GoneException` must NOT call `incrementScanCount`.
- Performance: expiry check is in-memory after single DB lookup — no extra query. `/r/{id}` still < 100ms.

### AC3 — Optional `expiresAt` at creation
- Given an authenticated user posts `POST /api/qr` with an optional `expiresAt: "YYYY-MM-DD"` field,
  Then the QR record is created with `expires_at = YYYY-MM-DDT23:59:59.000Z` (UTC).
- Given an authenticated user posts `POST /api/links` with an optional `expiresAt: "YYYY-MM-DD"` field,
  Then the shortlink record is created with `expires_at = YYYY-MM-DDT23:59:59.000Z` (UTC).
- Given `expiresAt` is omitted,
  Then `expires_at = NULL` (never expires).
- Given `expiresAt` is a non-date string (e.g. `"hello"`, `"2026-13-99"`),
  Then response is 400.
- Given `expiresAt` is a past date (e.g. yesterday),
  Then the record is created with that past date; `/r/{id}` will immediately return 410. Not a 400 error.
- Response shapes for `POST /api/qr` and `POST /api/links` include `expiresAt: string | null` (ISO 8601 UTC string or null).

### AC4 — Dedicated expiration endpoint
- `PATCH /api/qr/:id/expiration` (authenticated, owner only) accepts `{ expiresAt: "YYYY-MM-DD" | null }`.
- `PATCH /api/links/:id/expiration` (authenticated, owner only) accepts `{ expiresAt: "YYYY-MM-DD" | null }`.
- Both share a single `SetExpirationUseCase` (`{ id, userId, expiresAt: Date | null }`).
  - `SetExpirationUseCase` calls `findByIdAndUserId` — returns 404 if not found or not owner.
  - No `contentType` guard in `SetExpirationUseCase` (expiration column is set regardless; `RedirectUseCase` ignores it for non-url types anyway).
  - Calls `repository.save(qr.withExpiration(date | null))`.
- Response: 200 with updated item shape (QrItem or ShortLinkItem depending on controller).
- `null` body value clears expiration (never expires again).

### AC5 — List responses include `expiresAt`
- Given an authenticated user calls `GET /api/qr`,
  Then each item includes `expiresAt: string | null` (ISO 8601 or null).
- Given an authenticated user calls `GET /api/links`,
  Then each item includes `expiresAt: string | null` (ISO 8601 or null).

### AC6 — Dashboard UI
- Given a QR card or link card with `expiresAt` in the future,
  Then the card shows the expiry date (e.g. "Expire le 25 août 2026").
- Given a QR card or link card with `expiresAt` in the past,
  Then the card shows a visual "Expiré" badge.
- Given a QR card or link card with `expiresAt: null`,
  Then no expiry indicator is shown.
- Each card has a date input to set / update expiry (HTML `<input type="date" />`), and a "Supprimer l'expiration" control to clear it (`expiresAt: null`).
- QR creation form gains an optional `<input type="date" />` for expiry.
- Short link creation form gains an optional `<input type="date" />` for expiry.

## Out of Scope

- Automatic deletion of expired records (row stays in DB; only the redirect is blocked).
- Expiration on non-URL content types (Wi-Fi, vCard, email, text — no redirect exists).
- Bulk expiry operations.
- Expiry notifications / webhooks.
- Grace period or soft-expiry.
- Time-precision input (date + hour) — date-only for now; backwards-compatible to add later.
- `/q/{id}` public QR page gated by expiry — see EC5.

## Edge Cases

### EC1 — Clock skew
Server clock is authoritative. `expiresAt <= serverNow (UTC)` → 410. No client-clock reliance.

### EC2 — Past date at creation
Given `expiresAt` is a valid past date string,
Then the record is created; `GET /r/{id}` immediately returns 410. Not a 400 error.

### EC3 — Edit target URL on an expired record
Given I own an expired redirect and call `PATCH /api/qr/:id` or `PATCH /api/links/:id`,
Then the URL update succeeds (no expiry check in EditTargetUrlUseCase or EditLinkUseCase).
The record remains expired until expiry is separately cleared.

### EC4 — Delete expired record
Given an expired record,
When it is deleted,
Then existing delete flow (DB + MinIO cleanup) applies unchanged. `/r/{id}` returns 404 (row gone) not 410.

### EC5 — `/q/{id}` public QR page
Given a QR code's `expiresAt` is in the past,
When anyone visits `/q/{id}`,
Then the SPA renders normally (it is a static page; expiry only gates `/r/{id}`).
The QR image on that page encodes `/r/{id}`, which will 410 on scan — the user sees the consequence there.

### EC6 — Non-URL contentType with `expiresAt` set
Given a QR record with `contentType != 'url'` (Wi-Fi, vCard, etc.) has `expires_at` set,
When `RedirectUseCase` is called (which can't happen — non-URL types return 404 before expiry check),
Then behavior is moot. Expiry check in `RedirectUseCase` occurs only after the `contentType !== 'url'` guard passes.
`SetExpirationUseCase` may set `expires_at` on non-url records without error (no guard; column is nullable for all rows).

### EC7 — Timezone and storage
Given `expiresAt: "2026-08-25"` arrives from the API,
Then the backend stores `2026-08-25T23:59:59.000Z` (end-of-day UTC).
The API always returns ISO 8601 UTC string (e.g. `"2026-08-25T23:59:59.000Z"`).
Frontend displays in user's local timezone via `Intl.DateTimeFormat`.

### EC8 — Concurrent set + redirect
Last PATCH wins. No locking required (SQLite serializes writes).

## Grill Log

| # | Question | Resolution |
|---|---|---|
| OQ1 | Dedicated `PATCH /expiration` vs. fold into existing PATCH? | Dedicated — `PATCH /api/qr/:id/expiration` + `PATCH /api/links/:id/expiration`, sharing `SetExpirationUseCase`. Keeps existing use cases clean. |
| OQ2 | Expiration on QR codes AND shortlinks, or shortlinks only? | Both — they share `RedirectUseCase` and `qr_codes` table. Same column applies to both. |
| OQ3 | Past date at creation → 400 or accept? | Accept — 410 immediately, valid behavior, no reason to block. |
| OQ4 | Date-only or date+time input? | Date-only (`YYYY-MM-DD`), stored as `T23:59:59.000Z` UTC. `<input type="date" />` in UI. |
| OQ5 | `/q/{id}` returns 410 when expired? | No — SPA route, expiry gate is `/r/{id}` only. `/q/{id}` renders normally. |
