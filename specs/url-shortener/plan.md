# Plan — url-shortener

## Architecture

Feature slots into the existing bounded context as a parallel module to `QrModule`:

```
backend/
  src/
    domain/qr/
      qr-code.ts              ← add source field
      qr.repository.ts        ← add findAllLinksByUserId method
    application/
      qr/
        edit-target-url.use-case.ts  ← add source guard (EC7)
      links/                  ← NEW slice
        create-link.use-case.ts
        list-links.use-case.ts
        edit-link.use-case.ts
        delete-link.use-case.ts
    infrastructure/persistence/
      entities/qr-code.orm-entity.ts          ← add source column
      repositories/typeorm-qr.repository.ts   ← update findAllByUserId filter + add findAllLinksByUserId
    interfaces/http/
      controllers/links.controller.ts         ← NEW
      modules/links.module.ts                 ← NEW
      dto/
        create-link.dto.ts    ← NEW
        list-links.dto.ts     ← NEW (same shape as ListQrDto, reused directly)
        edit-link.dto.ts      ← NEW (same shape as EditTargetUrlDto)
  app.module.ts               ← add LinksModule

frontend/
  src/
    infrastructure/api/links.client.ts        ← NEW
    application/hooks/useLinks.ts             ← NEW
    presentation/pages/DashboardPage.tsx      ← add LinksSection component
```

NestJS module boundary: `LinksModule` does not depend on `QrModule`. Both depend on `DatabaseModule` (via TypeORM entity import). `LinksModule` does NOT import `MinioModule`.

Layer rules (from `CLAUDE.md`):
- `domain/qr/qr-code.ts` — adding `source` plain field. Zero new imports. ✓
- New use cases in `application/links/` — depend on `QrRepository` (domain). No infrastructure imports. ✓
- New `LinksController` in `interfaces/http/` — NestJS controllers/decorators. ✓

## Contracts

### Domain changes

```typescript
// domain/qr/qr-code.ts
interface QrCodeProps {
  // existing fields unchanged...
  source?: 'qr' | 'shortlink' | null;  // NEW — nullable for backward compat
}

class QrCode {
  get source(): 'qr' | 'shortlink' | null { return this.props.source ?? null; }
}
```

```typescript
// domain/qr/qr.repository.ts
abstract class QrRepository {
  // existing methods unchanged...
  abstract findAllLinksByUserId(userId: string, options: FindAllOptions): Promise<FindAllResult>;  // NEW
}
```

### Use case contracts

```typescript
// application/links/create-link.use-case.ts
interface CreateLinkCommand { userId: string; url: string; }
interface CreateLinkResult { link: QrCode; }
// Creates QrCode with source='shortlink', contentType='url', content=url,
// size=0, fgColor='', bgColor='', errorCorrection='M'. No image generation. No MinIO.
// shortUrl computed by controller from link.id + FRONTEND_URL (not use case responsibility).

// application/links/list-links.use-case.ts
interface ListLinksCommand { userId: string; page: number; limit: number; }
interface ListLinksResult { items: QrCode[]; total: number; page: number; limit: number; }

// application/links/edit-link.use-case.ts
interface EditLinkCommand { id: string; userId: string; url: string; }
interface EditLinkResult { link: QrCode; }
// findByIdAndUserId, then guard source === 'shortlink' → NotFoundException, then withContent(url), then save.

// application/links/delete-link.use-case.ts
interface DeleteLinkCommand { id: string; userId: string; }
// findByIdAndUserId, guard source === 'shortlink' → NotFoundException, then deleteById. No MinIO call. (AC7)

// application/qr/edit-target-url.use-case.ts — CHANGE
// After findByIdAndUserId: add guard source === 'shortlink' → NotFoundException (EC7)
```

### API endpoints (`LinksController`)

```
POST   /api/links            201  { id, url, shortUrl, scanCount: 0, createdAt }
GET    /api/links?page&limit 200  { items: ShortLinkItem[], total, page, limit }
PATCH  /api/links/:id        200  ShortLinkItem
DELETE /api/links/:id        204
```

`shortUrl` is computed in `LinksController` as `` `${this.config.getOrThrow('FRONTEND_URL')}/r/${link.id}` `` — same pattern as `QrController` computing `pngUrl`/`svgUrl` display from entity getters.

```typescript
interface ShortLinkItem {
  id: string;
  url: string;       // the stored target URL (content field)
  shortUrl: string;  // computed: `${FRONTEND_URL}/r/${id}` — never stored
  scanCount: number;
  createdAt: string;
}
```

### DTOs

```typescript
// interfaces/http/dto/create-or-edit-link.dto.ts — one shared class for POST + PATCH
export class CreateOrEditLinkDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;
}
// List pagination: reuse existing ListQrDto directly — no new file needed.
```

### Frontend contracts

```typescript
// infrastructure/api/links.client.ts
export interface ShortLinkItem {
  id: string; url: string; shortUrl: string; scanCount: number; createdAt: string;
}
export interface ShortLinkListResponse {
  items: ShortLinkItem[]; total: number; page: number; limit: number;
}
export async function listLinks(page?: number, limit?: number): Promise<ShortLinkListResponse>
export async function createLink(url: string): Promise<ShortLinkItem>
export async function editLink(id: string, url: string): Promise<ShortLinkItem>
export async function deleteLink(id: string): Promise<void>

// application/hooks/useLinks.ts
interface LinksHook {
  state: 'loading' | 'ready' | 'error';
  items: ShortLinkItem[];
  total: number;
  create: (url: string) => Promise<void>;
  edit: (id: string, url: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}
```

## Data Model

### ORM entity change

```typescript
// infrastructure/persistence/entities/qr-code.orm-entity.ts
@Column({ type: 'text', nullable: true })
source!: 'qr' | 'shortlink' | null;
```

`synchronize: true` in `DatabaseModule` → TypeORM runs `ALTER TABLE qr_codes ADD COLUMN source TEXT` on startup. SQLite supports `ADD COLUMN` for nullable columns; existing rows receive `NULL`.

### Repository filter

```typescript
// typeorm-qr.repository.ts — findAllByUserId (QR list)
where: { userId, source: Not('shortlink') }   // TypeORM OR for NULL:
// Use QueryBuilder: WHERE user_id = :uid AND (source IS NULL OR source != 'shortlink')

// typeorm-qr.repository.ts — findAllLinksByUserId (links list)
where: { userId, source: 'shortlink' }
```

### Sentinel values for shortlinks

| Field | Value | Why |
|---|---|---|
| `contentType` | `'url'` | `RedirectUseCase` checks `contentType` for redirect eligibility |
| `source` | `'shortlink'` | discriminator for list filtering and cross-entity guards |
| `size` | `0` | required by `QrCodeProps`, unused for shortlinks |
| `fgColor` | `''` | same |
| `bgColor` | `''` | same |
| `errorCorrection` | `'M'` | same |
| `encodedContent` | `null` | no QR string; `RedirectUseCase` uses `content` not `encodedContent` |
| `hasLogo` | `false` | default |

New QR codes from `GenerateQrUseCase` receive `source: 'qr'` going forward (replaces the current implicit NULL, making future filtering explicit).

## Dependencies

**New production dependencies:** none — this feature has no new third-party libraries.

**Existing dependencies used:**
- `class-validator` — `@IsUrl({ protocols: ['http', 'https'], require_protocol: true })` already in codebase (`edit-target-url.dto.ts`). Same annotation in new DTOs.
- `QrRepository` / `TypeOrmQrRepository` — extended, not replaced.
- `ConfigService` — `LinksController` reads `FRONTEND_URL` to compute `shortUrl`.

## Alternatives Considered

### 1. Separate `short_links` table
Rejected. `RedirectUseCase` calls `QrRepository.findById` — a separate table would require either unifying the lookup (two queries or JOIN) or a new `ShortLinkRepository` registered on the redirect path. The redirect path must respond in < 100ms (CLAUDE.md non-negotiable #4). Shared table = zero change to redirect. See spec OQ1.

### 2. Extend `POST /api/qr` with a `shortlink: true` flag
Rejected. `QrController` is already large. Mixing short link creation into the QR endpoint forces `GenerateQrUseCase` to branch on a flag, complicating the use case. `LinksController` at `/api/links` is a clean REST resource. See spec OQ2.

### 3. Reuse `DeleteQrUseCase` for link deletion
Rejected. `DeleteQrUseCase` calls `this.storage.delete(id)` which fires three MinIO `remove` calls. AC7 mandates no MinIO contact on short link deletion. `Promise.allSettled` swallows `NoSuchKey` errors so it wouldn't break, but it's wasteful I/O and violates the spec intent. `DeleteLinkUseCase` is 10 lines and explicit.

### 4. Reuse `EditTargetUrlUseCase` from `LinksController`
Rejected. `EditTargetUrlUseCase` guards `contentType !== 'url'` (throws if not URL). For shortlinks (`contentType: 'url'`), this guard would pass — the use case would edit a shortlink from the QR controller. EC7 requires cross-entity protection: only add a `source` guard to `EditShortLinkUseCase`. Changing `EditTargetUrlUseCase` to also block shortlinks is needed anyway (IQ3), but calling it from two controllers is confusing. Two use cases, two controllers, explicit intent.

### 5. `source` filter in use cases (fetch all, filter in memory)
Rejected. For a user with many records, fetching all then filtering in-memory is unbounded. SQL filter is the right layer. Repository is the appropriate place for persistence-level queries.

## Risks

**R1 — TypeORM `synchronize: true` + SQLite ALTER TABLE**
Adding a nullable column to an existing table with `synchronize: true`. SQLite supports `ALTER TABLE qr_codes ADD COLUMN source TEXT` (nullable, no DEFAULT issue). TypeORM generates this exact statement. Risk: low. Verify with an integration test that creates a row before the migration and asserts it survives with `source = NULL`.

**R2 — `findAllByUserId` filter regression**
Existing integration test for `listQrCodes` currently returns all user rows. After adding `source != 'shortlink'` filter, test rows with no `source` set (NULL) must still appear. TypeORM `Not('shortlink')` does not match NULLs in SQL — need `IsNull() OR Not('shortlink')` via QueryBuilder. Risk: medium. Cover explicitly in `typeorm-qr.repository.spec.ts`.

**R3 — `EditTargetUrlUseCase` regression**
Adding `source === 'shortlink'` → 404 guard changes existing behavior. No existing QR code has `source = 'shortlink'` (feature is new), so zero real-data risk. Existing unit tests pass `source: undefined` in mocks — they remain unaffected since `null !== 'shortlink'`. Low risk, but add a test explicitly.

## Grill Log

| # | Question | Resolution |
|---|---|---|
| GQ1 | `list-links.dto.ts` marked "new file, same shape as ListQrDto" — duplicate needed? | Use `ListQrDto` directly in `LinksController`. No new file. |
| GQ2 | `edit-link.dto.ts` — "same shape as EditTargetUrlDto" but field name differs (`url` vs `content`). Reusable? | Not reusable. Create one `CreateOrEditLinkDto` class (`@IsUrl() url: string`) used for both POST and PATCH. |
| GQ3 | `CreateLinkResult.shortUrl` — should use case compute it (needing `frontendUrl` in command) or controller? | Controller computes `shortUrl` from `link.id + FRONTEND_URL`. Use case returns `{ link: QrCode }` only; no `frontendUrl` in command. Keeps use case pure domain logic. |
| GQ4 | `findAllLinksByUserId` on `QrRepository` — domain interface leaking infrastructure concern? | `source` is a plain domain field on `QrCode` (no infrastructure imports). `QrRepository` expressing "find links" is domain intent. Acceptable. |
| GQ5 | `LinksModule` own TypeORM registration vs importing `QrModule` | Importing `QrModule` pulls in MinIO/image-generator deps `LinksModule` doesn't need. Own registration avoids module coupling. `TypeOrmModule.forFeature([QrCodeOrmEntity])` can be registered in multiple modules — NestJS supports this. |
| GQ6 | `source` field sentinel values — are empty strings `''` safe for non-nullable TEXT? | Yes. SQLite TEXT column accepts `''` without constraint issues. TypeORM stores as empty string. |
