# Review — internal-sharing

Reviewed: 2026-07-20

---

## Spec Coverage

| Criterion | Test(s) | Status |
|---|---|---|
| AC1 — qr_shares table schema + unique constraint + cascade | T15, T22, T23, T14 | ✅ |
| AC2 — POST /api/qr/:id/shares (201, 401, 403, 404×2, 400, 409) | T2–T7, T30, T36 | ✅ |
| AC3 — DELETE /api/qr/:id/shares/:shareId (204, 404, 401) | T8–T10, T31, T37 | ✅ |
| AC4 — GET /api/users (200 array, 401) | T13, T29, T39 | ✅ |
| AC5 — GET /api/qr/shared-with-me (200 flat, empty, 401, DESC order) | T11, T12, T20, T32, T38 | ✅ |
| AC6 — GET /api/qr list embeds shares with recipientName | T33, T34 | ✅ |
| AC6 — GET /api/qr/:id embeds shares with recipientName (non-empty) | T35 (empty only) | ❌ **GAP** |
| AC7 — Cascade: shares deleted before QR | T14, T22 | ✅ |
| AC8 — QrCard share panel (picker, submit btn, recipients, unshare btn) | T53–T56 | ✅ |
| AC8 — User-picker excludes self (EC7) | — no test | ❌ **GAP** |
| AC9 — Shared-with-me section (renders, hides, shared-by-name, no controls) | T59–T62 | ✅ |
| AC10 — GET /api/auth/me returns avatarUrl (DB lookup + null fallback) | T27, T28 | ✅ |
| AC11 — Tab navigation (tabs exist, QR default, links tab switches) | T50–T52 | ✅ |
| AC12 — User avatar / initials / name in header | T57, T58 | ✅ |

---

## Architecture Drift

**1. `findOne` drops `recipientName` — `qr.controller.ts:142`**

The `GET /api/qr/:id` endpoint always serializes shares as `{ shareId, recipientId, recipientName: '' }`. The list endpoint correctly resolves names via `userRepository.findAll()` (same pattern, lines 69–73). AC6 says both list and single-item responses must include `recipientName`. The drift exists because T35 only exercises the empty-shares path and never forced the name-resolution branch.

**2. User-picker does not exclude self — `DashboardPage.tsx`**

EC7 (grill log, spec.md): "Frontend picker filters self out before rendering options." The `QrCard` component renders `users.map(...)` with no filter. The `currentUser` from `useCurrentUser()` is available in `DashboardPage` but not passed to `QrCard`. No test was written for this behavior; it was listed in the spec edge cases but never translated into a task.

---

## Constitution Violations

None.

- Domain layer (`domain/qr/qr-share.ts`, `domain/qr/qr-share.repository.ts`): zero framework imports — ✅
- URL QR codes still encode `/r/{id}`: unchanged — ✅
- No direct MinIO URLs in API responses: unchanged — ✅
- `/r/{id}` unauthenticated and fast: unchanged — ✅
- Auth cookies httpOnly: unchanged — ✅
- FRONTEND_URL drives all public links: unchanged — ✅
- SQLite only: ✅
- Deleted QR codes return 404: ✅

---

## TDD-Discipline Smells

**V6 — Untested branch in `findOne`:** `GET /api/qr/:id` with non-empty shares never resolves `recipientName`. Test T35 only verifies `shares: []`. The implementation short-cuts to `''` with no test demanding the name, so this went undetected.

**V7 — Missing test for EC7 (picker excludes self):** EC7 was resolved in the grill log but never translated into a task entry in `tasks.md`. No test was written; the behavior was never forced.

---

## Verdict: **ready for /qa**

Two rework items were identified and resolved:

### Rework 1 — `findOne` resolves `recipientName` (fixed)

`backend/src/interfaces/http/controllers/qr.controller.ts`: `findOne` now calls `userRepository.findAll()` when shares are non-empty and maps through `toShareItem`, matching the list endpoint pattern.
Test T35b added and GREEN.

### Rework 2 — User-picker excludes self (fixed)

`frontend/src/presentation/pages/DashboardPage.tsx`: `users` prop passed to `QrCard` is now filtered: `users.filter(u => u.id !== currentUser?.id)`.
Test T55b added and GREEN.

All 338 backend + 111 frontend tests GREEN post-rework.
