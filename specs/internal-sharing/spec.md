# Spec — internal-sharing

## Summary

Allow the authenticated owner of a QR code to share it with other registered users of the household. Shared recipients see a "Partagé avec moi" sub-section in their dashboard; they can view and download the QR but cannot edit or delete it. Sharing is managed via a new `qr_shares` join table. A `GET /api/users` endpoint exposes the household user list. Shares are embedded in QR list and single-item responses.

Also in this feature: dashboard tab navigation (QR Codes / Liens courts), and authenticated user name + avatar in the header (via enriched `GET /api/auth/me`).

## User Stories

**Story 1 — Share a QR with a household member**

Given I am authenticated and own a QR code,
When I POST `/api/qr/{id}/shares` with `{ "recipientId": "<userId>" }`,
Then a share record is created and I receive 201 with `{ shareId, recipientId, createdAt }`.

**Story 2 — Unshare a QR**

Given I am authenticated and own a QR code I previously shared,
When I DELETE `/api/qr/{id}/shares/{shareId}`,
Then the share is removed and I receive 204.

**Story 3 — Browse household users to share with**

Given I am authenticated,
When I GET `/api/users`,
Then I receive the list of all registered users `{ id, name, email, avatarUrl }[]` (including myself).

**Story 4 — See QR codes shared with me**

Given I am authenticated,
When I GET `/api/qr/shared-with-me`,
Then I receive a flat array of full QrItem objects each augmented with `sharedBy: { id, name }`,
And items are ordered by share `created_at` descending.

**Story 5 — Share UI on QrCard**

Given I am authenticated and view a QrCard I own,
When the card renders,
Then I see the list of current recipients (embedded in the item from the list response),
And a user-picker + "Share" button to add a new recipient,
And an "Unshare" button per recipient to remove them.

**Story 6 — Shared-with-me section in Dashboard**

Given I am authenticated and at least one QR has been shared with me,
When the dashboard renders,
Then a "Partagé avec moi" section appears below my own QR list,
And each shared card shows download controls but no edit, delete, or share management UI.

## Acceptance Criteria

**AC1 — Data model: `qr_shares` table**

Given the app starts with TypeORM `synchronize: true`,
When the schema is applied,
Then a `qr_shares` table exists with columns `(id TEXT PK, qr_id TEXT, owner_id TEXT, recipient_id TEXT, created_at DATETIME)`,
And a unique constraint on `(qr_id, recipient_id)` prevents duplicate shares,
And application-layer cascade in `DeleteQrUseCase` removes all shares for the QR before deletion (SQLite FK pragmas are OFF by default).

**AC2 — POST /api/qr/:id/shares (create share)**

Given I own QR `{id}` and `{recipientId}` is a registered user different from me,
When POST `/api/qr/{id}/shares` with `{ "recipientId": "{recipientId}" }`,
Then response is 201 `{ shareId, recipientId, createdAt }`.

Given I do not own QR `{id}` (but it exists),
When POST `/api/qr/{id}/shares`,
Then response is 403.

Given QR `{id}` does not exist,
When POST `/api/qr/{id}/shares`,
Then response is 404.

Given `recipientId === ownerId` (sharing with self),
When POST `/api/qr/{id}/shares`,
Then response is 400.

Given share `(qrId, recipientId)` already exists,
When POST `/api/qr/{id}/shares` with the same `recipientId`,
Then response is 409.

Given `{recipientId}` does not exist in the users table,
When POST `/api/qr/{id}/shares`,
Then response is 404.

Given I am not authenticated,
When POST `/api/qr/{id}/shares`,
Then response is 401.

**AC3 — DELETE /api/qr/:id/shares/:shareId (unshare)**

Given I own share `{shareId}` on QR `{id}`,
When DELETE `/api/qr/{id}/shares/{shareId}`,
Then response is 204 and share record is removed.

Given share `{shareId}` does not exist or belongs to a different owner,
When DELETE `/api/qr/{id}/shares/{shareId}`,
Then response is 404.

Given I am not authenticated,
When DELETE `/api/qr/{id}/shares/{shareId}`,
Then response is 401.

**AC4 — GET /api/users (list household users)**

Given I am authenticated,
When GET `/api/users`,
Then response is 200 with array `[{ id, name, email, avatarUrl }]` for all registered users including the caller.

Given I am not authenticated,
When GET `/api/users`,
Then response is 401.

**AC5 — GET /api/qr/shared-with-me (shared items — flat list)**

Given at least one QR is shared with me,
When GET `/api/qr/shared-with-me`,
Then response is 200 with a flat array of QrItem objects (same fields as `GET /api/qr` list items) each including `sharedBy: { id, name }`,
And items are ordered by share `created_at` DESC,
And no pagination envelope is used.

Given no QR is shared with me,
When GET `/api/qr/shared-with-me`,
Then response is 200 with `[]`.

Given I am not authenticated,
When GET `/api/qr/shared-with-me`,
Then response is 401.

**AC6 — GET /api/qr list and GET /api/qr/:id embed shares**

Given I am authenticated and own QR `{id}` with N shares,
When GET `/api/qr` or GET `/api/qr/{id}`,
Then each item in the response includes `shares: [{ shareId, recipientId, recipientName }]`,
And items with no shares have `shares: []`.

**AC7 — Cascade: shares removed on QR deletion**

Given QR `{id}` has N shares,
When the owner deletes QR `{id}` via DELETE `/api/qr/{id}`,
Then all N shares for that QR are deleted (application-layer cascade in `DeleteQrUseCase`),
And recipients no longer see the item in `GET /api/qr/shared-with-me`.

**AC8 — Frontend: QrCard share management**

Given I view a QrCard I own (shares embedded in list item),
When it renders,
Then a share panel shows current recipients (`data-testid="share-recipient-{userId}"`),
And a user-picker dropdown (`data-testid="share-user-picker"`) populated from `GET /api/users` excluding self,
And a "Partager" button (`data-testid="share-submit-btn"`),
And per-recipient "Retirer" button (`data-testid="unshare-btn-{userId}"`).

Given I pick a user and click "Partager",
When the action completes,
Then `shares` array on the item in state is updated with the new recipient.

Given I click "Retirer" for a recipient,
When the action completes,
Then that recipient is removed from `shares` array in state.

**AC9 — Frontend: Shared-with-me section**

Given at least one QR is shared with me (loaded via `GET /api/qr/shared-with-me`),
When the dashboard renders,
Then a section with heading "Partagé avec moi" appears (`data-testid="shared-with-me-section"`),
And each card shows `sharedBy.name` (`data-testid="shared-by-name"`),
And each card has PNG/SVG download buttons but no edit, delete, or share-management controls.

Given no QR is shared with me,
When the dashboard renders,
Then no element with `data-testid="shared-with-me-section"` is present.

**AC10 — GET /api/auth/me returns avatarUrl**

Given I am authenticated,
When GET `/api/auth/me`,
Then response is 200 with `{ id, email, name, avatarUrl }` (avatarUrl fetched from DB via `UserRepository`).

**AC11 — Frontend: tab navigation**

Given the dashboard renders,
When it mounts,
Then a tab bar appears with "QR Codes" (`data-testid="tab-qr"`) and "Liens courts" (`data-testid="tab-links"`),
And "QR Codes" is the active tab by default.

Given "QR Codes" tab is active,
When it renders,
Then `CreateForm` + QR list + "Partagé avec moi" sub-section are visible,
And `LinksSection` is hidden.

Given I click "Liens courts" tab,
When it becomes active,
Then `LinksSection` is visible,
And QR content is hidden.

**AC12 — Frontend: user name + avatar in header**

Given `GET /api/auth/me` returns `{ id, name, avatarUrl }`,
When the dashboard header renders,
Then the header shows the user's avatar (`data-testid="user-avatar"`) and name (`data-testid="user-name"`),
And the "Se déconnecter" button remains.

Given `avatarUrl` is an empty string or the fetch is still loading,
When the header renders,
Then no broken image is shown (avatar falls back to initials or placeholder).

## Out of Scope

- Sharing short links (URL shortener items) — only QR codes are shareable.
- Recipient editing target URL or deleting QR — view + download only.
- Email/push notification when a QR is shared.
- Pagination on shared-with-me.
- Public share links (sharing outside the household — `/q/{id}` already covers that).
- Admin UI for cross-user share management.

## Edge Cases

**EC1 — Share then delete QR:** `DeleteQrUseCase` removes all shares for the QR (via `QrShareRepository.deleteByQrId`) before removing the QR itself and its MinIO files.

**EC2 — Shared QR expires:** Recipient still sees it in shared-with-me list; `/r/{id}` returns 410 for URL-type QRs. No special handling — existing expiration behavior applies uniformly.

**EC3 — Shared QR target URL edited:** Recipient sees updated content on next scan (they access the same live QR/redirect). No share invalidation needed.

**EC4 — Route ordering:** `@Get('shared-with-me')` must be declared before `@Get(':id')` in `QrController` to prevent NestJS first-match capturing the literal as a param. Same pattern already established with `@Patch(':id/expiration')` before `@Patch(':id')`.

**EC8 — Avatar fallback:** If `avatarUrl` is empty string or request fails, header displays user initials (first letter of `name`) in a colored circle instead of a broken `<img>`.

**EC9 — Tab state not persisted:** Active tab resets to "QR Codes" on page reload. No URL hash or localStorage needed.

**EC5 — Concurrent duplicate share submission:** Unique constraint `(qr_id, recipient_id)` at DB level ensures at most one survives; application catches the DB unique violation and returns 409.

**EC6 — Recipient not found vs owner check order:** QR existence checked first (404 if missing), then owner check (403 if not owner), then recipient existence (404 if unknown), then duplicate check (409). This order prevents leaking QR existence to non-owners.

**EC7 — `GET /api/users` includes current user:** Frontend picker filters self out before rendering options. Backend stays simple.

## Grill Log

| Question | Resolution | Date |
|---|---|---|
| OQ1: `GET /api/users` — include self? | Return all users. Frontend filters self from picker. | 2026-07-20 |
| OQ2: Domain placement for `QrShare` | `domain/qr/qr-share.ts` + `domain/qr/qr-share.repository.ts`; use cases in `application/sharing/` | 2026-07-20 |
| OQ3: Shared-with-me pagination? | Flat array, no pagination. Household scale. | 2026-07-20 |
| OQ4: Response shape for shared-with-me? | Full QrItem shape + `sharedBy: { id, name }`. Reuses existing mapper. | 2026-07-20 |
| OQ5: UsersController placement? | New `UsersModule` imports `AuthModule` (which exports `UserRepository`), adds `ListUsersUseCase` + `UsersController`. | 2026-07-20 |
| Implied: Shares in list response? | Shares embedded in `GET /api/qr` list items and `GET /api/qr/:id` response as `shares: [{shareId, recipientId, recipientName}]`. No extra round-trip for share panel. | 2026-07-20 |
| EC6: Response ordering for error codes on POST /shares? | QR existence → 404; ownership → 403; self-share → 400; recipient existence → 404; duplicate → 409. Order prevents existence leakage to non-owners. | 2026-07-20 |
| UI: Tab navigation? | Two tabs: "QR Codes" (default, shows create + list + shared-with-me) and "Liens courts". No 3rd tab — shared-with-me is QR content. | 2026-07-20 |
| UI: User header — where does avatarUrl come from? | `GET /api/auth/me` enriched to return `avatarUrl` from DB (`UserRepository.findById`). `CurrentUserPayload` in JWT has no avatarUrl. AuthController.me() does DB lookup. | 2026-07-20 |
| UI: Avatar fallback? | Initials (first letter of name) in colored circle. No broken image shown. | 2026-07-20 |
