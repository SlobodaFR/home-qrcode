# Plan — internal-sharing

## Architecture

Feature spans all four layers in the backend and all four in the frontend. No new third-party libraries required.

### Backend — new files

```
domain/qr/
  qr-share.ts                  ← QrShare entity (new)
  qr-share.repository.ts       ← abstract QrShareRepository (new)

application/sharing/
  share-qr.use-case.ts         ← ShareQrUseCase (new)
  unshare-qr.use-case.ts       ← UnshareQrUseCase (new)
  list-shared-with-me.use-case.ts  ← ListSharedWithMeUseCase (new)

application/users/
  list-users.use-case.ts       ← ListUsersUseCase (new)

infrastructure/persistence/
  entities/qr-share.orm-entity.ts              (new)
  repositories/typeorm-qr-share.repository.ts  (new)

interfaces/http/
  controllers/users.controller.ts  (new)
  modules/users.module.ts          (new)
  dto/create-share.dto.ts          (new)
```

### Backend — modified files

```
domain/user/user.repository.ts          ← add findAll()
application/qr/delete-qr.use-case.ts   ← inject QrShareRepository; cascade-delete shares before QR
interfaces/http/controllers/auth.controller.ts  ← me() enriched with avatarUrl from DB (async, fallback graceful)
interfaces/http/controllers/qr.controller.ts    ← add POST/DELETE shares routes,
                                                   GET shared-with-me (before :id),
                                                   embed shares in list + single-item responses
interfaces/http/modules/qr.module.ts   ← add QrShareOrmEntity, QrShareRepository + sharing use cases
                                          re-bind UserRepository (TypeOrmModule.forFeature([UserOrmEntity]))
app.module.ts                          ← add UsersModule
```

### Frontend — new files

```
infrastructure/api/sharing.client.ts    ← shareQr, unshareQr, listSharedWithMe
infrastructure/api/users.client.ts      ← listUsers, fetchCurrentUser
application/hooks/useSharedWithMe.ts   ← hook for shared-with-me section
application/hooks/useCurrentUser.ts    ← hook for header user display
```

### Frontend — modified files

```
infrastructure/api/qr-auth.client.ts   ← QrItem gets shares: ShareItem[]
application/hooks/useDashboard.ts      ← add share(), unshare()
presentation/pages/DashboardPage.tsx   ← tabs, user header, QrCard share panel, SharedWithMeSection
```

---

## Contracts

### Domain

**`QrShare` entity** (`domain/qr/qr-share.ts`)
```typescript
interface QrShareProps {
  id: string;
  qrId: string;
  ownerId: string;
  recipientId: string;
  createdAt: Date;
}
class QrShare {
  static create(props: QrShareProps): QrShare
  get id(): string
  get qrId(): string
  get ownerId(): string
  get recipientId(): string
  get createdAt(): Date
}
```

**`QrShareRepository`** (`domain/qr/qr-share.repository.ts`)
```typescript
abstract class QrShareRepository {
  abstract save(share: QrShare): Promise<void>;
  abstract findById(shareId: string): Promise<QrShare | null>;
  // IN query — caller must guard against empty array (SQLite IN() invalid)
  abstract findByQrIds(qrIds: string[]): Promise<QrShare[]>;
  // JOIN qr_shares + qr_codes; ordered by share.createdAt DESC
  abstract findWithQrByRecipientId(recipientId: string): Promise<{ share: QrShare; qrCode: QrCode }[]>;
  abstract deleteById(shareId: string): Promise<void>;
  abstract deleteByQrId(qrId: string): Promise<void>;
}
```

**`UserRepository` addition** (`domain/user/user.repository.ts`)
```typescript
abstract findAll(): Promise<User[]>;
```

### Application use cases

**`ShareQrUseCase`** — `application/sharing/share-qr.use-case.ts`
```typescript
interface ShareQrCommand { qrId: string; ownerId: string; recipientId: string; }
interface ShareQrResult { share: QrShare; }
```
Execution steps (in order — order matters for correct status codes):
1. `qrRepository.findById(qrId)` → `NotFoundException` if null
2. `qr.userId !== ownerId` → `ForbiddenException`
3. `ownerId === recipientId` → `BadRequestException`
4. `userRepository.findById(recipientId)` → `NotFoundException` if null
5. `qrShareRepository.findByQrAndRecipient(qrId, recipientId)` — helper query; `ConflictException` if exists
6. `qrShareRepository.save(QrShare.create({ id: uuid(), qrId, ownerId, recipientId, createdAt: new Date() }))`

> Requires `qrRepository` + `qrShareRepository` + `userRepository` injected.
> Needs `findByQrAndRecipient` (not in interface above) — add: `abstract findByQrAndRecipient(qrId: string, recipientId: string): Promise<QrShare | null>`.

**`UnshareQrUseCase`** — `application/sharing/unshare-qr.use-case.ts`
```typescript
interface UnshareQrCommand { shareId: string; qrId: string; ownerId: string; }
```
Execution steps:
1. `qrShareRepository.findById(shareId)` → `NotFoundException` if null
2. `share.qrId !== qrId || share.ownerId !== ownerId` → `NotFoundException` (no existence leak)
3. `qrShareRepository.deleteById(shareId)`

**`ListSharedWithMeUseCase`** — `application/sharing/list-shared-with-me.use-case.ts`
```typescript
interface ListSharedWithMeCommand { userId: string; }
interface SharedWithMeItem { qrCode: QrCode; sharedBy: { id: string; name: string }; }
interface ListSharedWithMeResult { items: SharedWithMeItem[]; }
```
Execution steps:
1. `qrShareRepository.findWithQrByRecipientId(userId)` → `[{share, qrCode}]` ordered by share.createdAt DESC
2. `userRepository.findAll()` → all users in a Map keyed by `id`
3. Merge: `{ qrCode, sharedBy: { id: share.ownerId, name: ownerMap.get(share.ownerId)?.name ?? '' } }`

> `findAll()` for owner names — simpler than N `findById` calls; household size makes it O(1) in practice.

**`ListUsersUseCase`** — `application/users/list-users.use-case.ts`
```typescript
interface ListUsersResult { users: User[]; }
// Steps: userRepository.findAll()
```

### API endpoints (new / changed)

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/qr/:id/shares` | required | Body: `{ recipientId }`. Returns 201 `{ shareId, recipientId, createdAt }` |
| `DELETE` | `/api/qr/:id/shares/:shareId` | required | Returns 204 |
| `GET` | `/api/qr/shared-with-me` | required | Flat `SharedQrItem[]`. **Declared before `@Get(':id')` in controller.** |
| `GET` | `/api/users` | required | Returns `{ id, name, email, avatarUrl }[]` |
| `GET` | `/api/auth/me` | required | Now returns `{ id, email, name, avatarUrl }`. If DB lookup returns null (wiped DB edge case), falls back to JWT payload with `avatarUrl: ''` — no 500. |

**`GET /api/qr` and `GET /api/qr/:id` response change:** each item gains `shares: [{ shareId, recipientId, recipientName }]`.

Controller logic for embedding shares in list:
```typescript
const { items } = await this.listQr.execute(...);
const qrIds = items.map(q => q.id);
const allShares = qrIds.length > 0
  ? await this.qrShareRepository.findByQrIds(qrIds)   // guard: skip if empty
  : [];
const sharesByQrId = groupBy(allShares, s => s.qrId); // group in-memory
// merge into response items
```

**`GET /api/qr/shared-with-me` response:** `SharedQrItem` = full list-item shape + `sharedBy: { id, name }`. The `shares: []` field is intentionally empty for shared-with-me items — recipients have no share-management context.

### DTO

**`CreateShareDto`** (`interfaces/http/dto/create-share.dto.ts`)
```typescript
class CreateShareDto {
  @IsString() @IsNotEmpty() recipientId: string;
}
```

### Frontend types (new / changed)

```typescript
// qr-auth.client.ts
interface ShareItem { shareId: string; recipientId: string; recipientName: string; }
interface QrItem { /* existing */ shares: ShareItem[]; }  // ADDED

// sharing.client.ts
interface SharedQrItem extends QrItem { sharedBy: { id: string; name: string }; }
function shareQr(qrId: string, recipientId: string): Promise<{ shareId: string; recipientId: string; createdAt: string }>
function unshareQr(qrId: string, shareId: string): Promise<void>
function listSharedWithMe(): Promise<SharedQrItem[]>

// users.client.ts
interface UserItem { id: string; name: string; email: string; avatarUrl: string; }
function listUsers(): Promise<UserItem[]>
function fetchCurrentUser(): Promise<UserItem>  // GET /api/auth/me

// useDashboard.ts additions
share: (qrId: string, recipientId: string) => Promise<void>   // updates items[].shares in state
unshare: (qrId: string, shareId: string) => Promise<void>     // updates items[].shares in state
```

---

## Data Model

### New table: `qr_shares`

```
id           TEXT  PK
qr_id        TEXT  NOT NULL   ← app-layer cascade on QR delete
owner_id     TEXT  NOT NULL   ← denormalized at share time; always equals qr_codes.user_id
recipient_id TEXT  NOT NULL
created_at   DATETIME NOT NULL
UNIQUE(qr_id, recipient_id)
```

TypeORM ORM entity registered via `TypeOrmModule.forFeature([QrShareOrmEntity])` in `QrModule`. `autoLoadEntities: true` in `DatabaseModule` picks it up — no changes to `database.module.ts`.

`@Unique(['qrId', 'recipientId'])` on the ORM entity creates the DB-level unique constraint via `synchronize: true`.

### `users` table (unchanged)

`avatarUrl` already present. `findAll()` is a new method; no schema change.

### `qr_codes` table (unchanged)

`shares` in responses is computed from `qr_shares` at request time, not stored on the row.

---

## Dependencies

**No new npm packages.** All functionality uses existing stack:
- TypeORM (`IN` query for `findByQrIds`, JOIN for `findWithQrByRecipientId`, `@Unique` decorator)
- `@nestjs/common` exceptions (`ForbiddenException`, `ConflictException`, `BadRequestException`)
- `class-validator` for `CreateShareDto`
- React `useState` for tab navigation and share panel

---

## Alternatives Considered

**A. `UsersModule` importing `AuthModule` vs re-binding `UserRepository` locally**
Rejected import approach: `LinksModule` establishes the pattern — re-bind repos locally via `TypeOrmModule.forFeature`. Importing `AuthModule` to get `UserRepository` would introduce a cross-module dependency that wasn't present before and would pull in `APP_GUARD` registration into the dependency chain (even if NestJS deduplicates it). Re-binding locally is consistent and explicit.

**B. Separate `SharingModule` vs keeping sharing use cases in `QrModule`**
Rejected separate module: sharing routes (`/api/qr/:id/shares`) live on `QrController` in `QrModule`. A second controller with `@Controller('qr')` is valid in NestJS but confusing. A separate `SharingModule` would either need its own `@Controller('qr')` controller or route-sharing with `QrModule`, both awkward. Keeping providers in `QrModule` is pragmatic for this feature size.

**C. `shares` embedded in list response vs lazy `GET /api/qr/:id/shares` on panel open**
Rejected lazy fetch: N round-trips per page load (one per QrCard). Embedding via `findByQrIds` IN-query adds one query per `GET /api/qr` page load. Per grill-spec resolution, embedding is the agreed approach.

**D. DB-level FK cascade (`ON DELETE CASCADE`) vs application-layer cascade**
Rejected FK cascade: SQLite FK pragma is OFF by default; codebase has no migration enabling it. Application-layer cascade in `DeleteQrUseCase` mirrors existing MinIO cleanup pattern.

**E. `findByIdAndUserId` in `ShareQrUseCase` to combine existence + ownership check**
Rejected: AC2 requires 404 for missing QR and 403 for non-owner — distinct status codes. `findByIdAndUserId` returns null for both cases. Two separate queries required.

**F. Tab navigation via React Router vs local state**
Rejected React Router: not in the stack; adding routing infrastructure for two tabs is disproportionate. `useState<'qr' | 'links'>` in `DashboardPage` is sufficient.

**G. `avatarUrl` in JWT claims vs DB lookup on `GET /api/auth/me`**
Rejected JWT approach: `auth.sloboda.fr` controls JWT claim content, outside our control. DB lookup is the only option. Graceful fallback if `findById` returns null (wiped-DB edge case): return JWT payload with `avatarUrl: ''` — no 500.

**H. N individual `findById` calls for owner names in `ListSharedWithMeUseCase` vs `findAll()`**
Rejected N calls: even with deduplication, household user count (2–5) makes `findAll()` trivially cheap and simpler to implement. `findAll()` is being added anyway for `GET /api/users`.

**I. `UnshareQrCommand` without `qrId` vs with `qrId`**
Rejected without: `DELETE /api/qr/WRONG-QR-ID/shares/VALID-SHARE-ID` would silently succeed. Including `qrId` in the command and validating `share.qrId === qrId` in the use case ensures URL consistency.

---

## Risks

| Risk | Mitigation |
|---|---|
| `QrItem` type change (`shares: ShareItem[]`) breaks all existing test mocks (~20+ files) | Systematic `replace_all` pass adding `shares: []` to mock factories — same operation as `expiresAt: null` in link-expiration |
| `@Get('shared-with-me')` declared after `@Get(':id')` → route swallowed | Unit test asserts the literal route returns non-404; integration test confirms |
| `findByQrIds([])` with empty page → SQLite `IN ()` syntax error | Controller guards: `if (qrIds.length === 0) return []` before calling the repo |
| `AuthController.me()` becomes async | Update existing test; add assertion for `avatarUrl` in response |
| `DeleteQrUseCase` grows: new `QrShareRepository` dependency | Existing unit tests need `QrShareRepository` mock; `deleteByQrId` must be called before `deleteById` |
| TypeORM `@Unique(['qrId', 'recipientId'])` not applied until `synchronize: true` runs | Integration test verifies duplicate insert raises conflict |

---

## Grill Log

| Decision | Resolution | Date |
|---|---|---|
| `UsersModule`: import `AuthModule` vs re-bind locally | Re-bind locally — matches `LinksModule` pattern; no cross-module coupling | 2026-07-20 |
| `UnshareQrCommand` missing `qrId` | Added `qrId` to command; use case validates `share.qrId === qrId` before delete | 2026-07-20 |
| `findByQrIds([])` empty array guard | Caller guards: skip call if `qrIds.length === 0`; noted in contract | 2026-07-20 |
| `SharingModule` vs keep in `QrModule` | Keep in `QrModule` — sharing routes on `QrController`, splitting controllers is confusing | 2026-07-20 |
| `QrShareRepository.findByQrAndRecipient` gap | Added to interface for duplicate check in `ShareQrUseCase` | 2026-07-20 |
| `AuthController.me()` null DB result fallback | Graceful fallback: return JWT payload + `avatarUrl: ''`. No 500. | 2026-07-20 |
| Owner names in `ListSharedWithMeUseCase` | Use `findAll()` (household-scale, added anyway for `GET /api/users`) — no N+1 | 2026-07-20 |
| `shares: []` on shared-with-me items | Intentional: recipients have no share-management context; noted in contracts | 2026-07-20 |
