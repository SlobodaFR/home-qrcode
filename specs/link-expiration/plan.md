# Plan — link-expiration

## Architecture

Feature is a cross-cutting concern over the existing `QrModule` and `LinksModule` (both operate on `qr_codes`). Changes touch all layers:

```
backend/
  src/
    domain/qr/
      qr-code.ts                   ← add expiresAt field + withExpiration()
    application/
      redirect/
        redirect.use-case.ts       ← add expiry guard (GoneException)
      expiration/                  ← NEW slice
        set-expiration.use-case.ts
      qr/
        generate-qr.use-case.ts    ← add optional expiresAt to command
      links/
        create-link.use-case.ts    ← add optional expiresAt to command
    infrastructure/persistence/
      entities/qr-code.orm-entity.ts     ← add expires_at column
      repositories/typeorm-qr.repository.ts  ← map expiresAt in save + toDomain
    interfaces/http/
      controllers/
        qr.controller.ts           ← PATCH :id/expiration + expiresAt in toResponse
        links.controller.ts        ← PATCH :id/expiration + expiresAt in toResponse
      dto/
        set-expiration.dto.ts      ← NEW
        create-qr.dto.ts           ← add optional expiresAt
        create-or-edit-link.dto.ts ← add optional expiresAt
      modules/
        qr.module.ts               ← provide SetExpirationUseCase
        links.module.ts            ← provide SetExpirationUseCase

frontend/
  src/
    infrastructure/api/
      qr-auth.client.ts            ← add expiresAt to QrItem, CreateQrPayload;
                                     add setQrExpiration()
      links.client.ts              ← add expiresAt to ShortLinkItem, createLink;
                                     add setLinkExpiration()
    application/hooks/
      useDashboard.ts              ← add setExpiration action
      useLinks.ts                  ← add setExpiration action
    presentation/pages/
      DashboardPage.tsx            ← QrCard + CreateForm expiry UI; LinksSection expiry UI
```

Layer rules (CLAUDE.md):
- `domain/qr/qr-code.ts`: zero new imports, plain Date field. ✓
- `application/expiration/set-expiration.use-case.ts`: depends only on `QrRepository` (domain). ✓
- `RedirectUseCase`: uses `GoneException` from `@nestjs/common` — same pattern as all other application use cases. ✓
- `SetExpirationUseCase` registered in both `QrModule` and `LinksModule` independently (same pattern as `TypeOrmQrRepository` dual-registration). ✓

## Contracts

### Domain changes

```typescript
// domain/qr/qr-code.ts
interface QrCodeProps {
  // ...existing fields...
  expiresAt?: Date | null;  // NEW — nullable
}

class QrCode {
  get expiresAt(): Date | null { return this.props.expiresAt ?? null; }
  withExpiration(date: Date | null): QrCode { return new QrCode({ ...this.props, expiresAt: date }); }
}
```

### Use case contracts

```typescript
// application/redirect/redirect.use-case.ts — CHANGE
// After contentType guard, before incrementScanCount:
// if (qr.expiresAt && qr.expiresAt <= new Date()) throw new GoneException();

// application/expiration/set-expiration.use-case.ts — NEW
interface SetExpirationCommand { id: string; userId: string; expiresAt: Date | null; }
interface SetExpirationResult { entity: QrCode; }
// findByIdAndUserId → null → NotFoundException
// qr.withExpiration(cmd.expiresAt) → save → return entity

// application/qr/generate-qr.use-case.ts — CHANGE
type BaseCmd = { userId: string; frontendUrl: string; expiresAt?: Date | null } & DisplayOptions;
// QrCode.create({ ...existing, expiresAt: cmd.expiresAt ?? null })

// application/links/create-link.use-case.ts — CHANGE
interface CreateLinkCommand { userId: string; url: string; expiresAt?: Date | null; }
// QrCode.create({ ...existing, expiresAt: cmd.expiresAt ?? null })
```

### API endpoints

```
PATCH /api/qr/:id/expiration      200  QrItem (with expiresAt)
PATCH /api/links/:id/expiration   200  ShortLinkItem (with expiresAt)
```

Updated response shapes:
```typescript
// QrItem (qr-auth.client.ts)
interface QrItem {
  // ...existing fields...
  expiresAt: string | null;  // NEW — ISO 8601 UTC or null
}

// ShortLinkItem (links.client.ts)
interface ShortLinkItem {
  // ...existing fields...
  expiresAt: string | null;  // NEW
}
```

Updated create payloads:
```typescript
// CreateQrPayload — url contentType only needs expiresAt, but simplest is allowing it on all
// (backend stores it; RedirectUseCase only checks it for contentType=url)
type CreateQrPayload = /* existing */ & { expiresAt?: string };  // date-only YYYY-MM-DD

// createLink(url, expiresAt?: string): Promise<ShortLinkItem>
```

### DTOs

```typescript
// interfaces/http/dto/set-expiration.dto.ts — NEW
export class SetExpirationDto {
  @ValidateIf(o => (o as SetExpirationDto).expiresAt !== null)
  @IsDateString()
  expiresAt!: string | null;
}

// interfaces/http/dto/create-qr.dto.ts — CHANGE
// Add at end of class:
@IsOptional()
@IsDateString()
expiresAt?: string;

// interfaces/http/dto/create-or-edit-link.dto.ts — CHANGE
// Add:
@IsOptional()
@IsDateString()
expiresAt?: string;
```

### Date conversion (controller layer)

```typescript
// Helper — lives in controller file or shared utils
function parseExpiryDate(s: string): Date {
  // "2026-08-25" → 2026-08-25T23:59:59.000Z
  return new Date(`${s}T23:59:59.000Z`);
}
```

Called in controllers before passing to use cases. Domain receives `Date | null`, never a raw string.

### Frontend contracts

```typescript
// qr-auth.client.ts — new function
export async function setQrExpiration(id: string, expiresAt: string | null): Promise<QrItem>
// PATCH /api/qr/:id/expiration with { expiresAt }

// links.client.ts — new function
export async function setLinkExpiration(id: string, expiresAt: string | null): Promise<ShortLinkItem>
// PATCH /api/links/:id/expiration with { expiresAt }

// useDashboard hook — new action
setExpiration: (id: string, expiresAt: string | null) => Promise<void>
// calls setQrExpiration, updates item in local state

// useLinks hook — new action
setExpiration: (id: string, expiresAt: string | null) => Promise<void>
// calls setLinkExpiration, updates item in local state
```

## Data Model

### ORM entity change

```typescript
// infrastructure/persistence/entities/qr-code.orm-entity.ts
@Column({ type: 'datetime', name: 'expires_at', nullable: true })
expiresAt!: Date | null;
```

`synchronize: true` → TypeORM runs `ALTER TABLE qr_codes ADD COLUMN expires_at DATETIME` on startup. SQLite supports nullable column addition; existing rows receive `NULL`.

### Repository changes

```typescript
// save(): add  expiresAt: qr.expiresAt,
// toDomain(): add  expiresAt: row.expiresAt ?? null,
```

No new repository methods needed. `SetExpirationUseCase` uses `findByIdAndUserId` + `save` (already abstract).

## Dependencies

**New production dependencies:** none.

**Existing used:**
- `@nestjs/common` — `GoneException` (HTTP 410). Already in `package.json`.
- `class-validator` — `@IsDateString()` already in codebase (`create-qr.dto.ts`). Same annotation reused.
- `TypeOrmModule` — existing `synchronize: true` handles column addition.

## Alternatives Considered

### 1. Fold `expiresAt` into existing `PATCH /api/qr/:id` and `PATCH /api/links/:id`
Rejected. `PATCH /api/qr/:id` maps to `EditTargetUrlUseCase` (URL content only, throws for non-url). `PATCH /api/links/:id` maps to `EditLinkUseCase`. Adding an optional `expiresAt` field to both DTOs conflates two distinct operations: "change where this link points" vs. "change when it expires". A caller wanting to only update expiry would still need to send `content`/`url`. Two dedicated endpoints are explicit and independently testable.

### 2. `SetExpirationUseCase` in `application/qr/` (QR slice)
Rejected. The use case serves both `QrModule` and `LinksModule` equally — it has no QR-specific logic (no `source` guard, no `contentType` guard). Placing it in `application/qr/` is misleading. A new `application/expiration/` slice makes the cross-cutting concern explicit. One file, one directory — acceptable granularity.

### 3. `GoneException` vs. custom `LinkExpiredException`
Rejected. NestJS has `GoneException` (HTTP 410) in `@nestjs/common`. Wrapping it in a custom exception adds zero value — the spec is unambiguous: expired → 410. No additional metadata (retry-after, etc.) required.

### 4. Store expiration as Unix timestamp (integer) instead of DATETIME
Rejected. SQLite `DATETIME` with TypeORM `type: 'datetime'` stores ISO strings natively and maps to `Date` objects. The existing `createdAt` column uses `@CreateDateColumn({ type: 'datetime' })` — same pattern. Consistent; no conversion layer needed at the DB boundary.

### 5. Per-type expiration columns (`qr_expires_at`, `link_expires_at`)
Rejected. QR codes and shortlinks share `qr_codes`. Adding separate columns would be meaningless (both would be null for their non-applicable type). Single `expires_at` column on the shared table is the only coherent option.

## Risks

**R1 — `@IsDateString()` rejects date-only strings in strict mode**
`class-validator`'s `@IsDateString()` without `{ strict: true }` accepts `YYYY-MM-DD`. With strict, it requires full datetime. Existing usage in codebase doesn't pass options — safe to rely on permissive default. Verify with a DTO unit test that `"2026-08-25"` passes and `"hello"` fails.

**R2 — TypeORM `synchronize: true` + SQLite column addition on non-empty DB**
Same risk as `source` column (resolved in url-shortener). SQLite `ALTER TABLE ADD COLUMN` works for nullable columns. Mitigated by integration test that creates a row pre-migration and asserts it survives with `expiresAt = null`.

**R3 — `GoneException` propagation through `@Redirect()` decorator**
`RedirectController` uses `@Redirect()`. When `RedirectUseCase` throws `GoneException`, NestJS's exception filter intercepts before `@Redirect` applies the 302. This is standard NestJS behavior — exceptions bypass the `@Redirect` decorator. Verify with an e2e test that seeds an expired record and asserts 410.

**R4 — `parseExpiryDate` timezone edge case**
`new Date("2026-08-25T23:59:59.000Z")` is always UTC regardless of server timezone. Node.js `Date` constructor with explicit `Z` suffix is unambiguous. Low risk; covered by a unit test on the helper.

## Grill Log

| # | Question | Resolution |
|---|---|---|
| GQ1 | Does `@IsDateString()` accept `YYYY-MM-DD` without `{ strict: true }`? | ✅ Verified via `validator.isISO8601('2026-08-25') === true`. No strict option needed. |
| GQ2 | Does `GoneException` propagate correctly through `@Redirect()` decorator? | ✅ NestJS exception filters intercept before `@Redirect` processes the return value. Thrown exception short-circuits `{ url, statusCode }` path entirely. Standard NestJS behavior. |
| GQ3 | Alt1 rejection — does folding into existing PATCH actually require sending `content`/`url`? | ✅ Confirmed. `EditTargetUrlDto.content` has `@IsUrl()` (required), `CreateOrEditLinkDto.url` has `@IsUrl()` (required). No optional-content mode exists. Dedicated endpoint is the only clean option. |
| GQ4 | Is `parseExpiryDate` UTC-safe in Node.js? | ✅ `new Date('2026-08-25T23:59:59.000Z')` produces consistent UTC regardless of server TZ. Explicit `Z` suffix is unambiguous. |
| GQ5 | Should `application/expiration/` break the convention that slices map to modules? | Judgment call — acceptable. Existing slices (`auth`, `links`, `qr`, `redirect`) map to modules, but `SetExpirationUseCase` is genuinely cross-cutting (QrModule + LinksModule). One-file directory is preferred over placing cross-module logic in `application/qr/` (misleading) or duplicating the use case. |
| GQ6 | Should `SetExpirationUseCase` have a source guard to prevent cross-entity calls? | No. Setting expiration is semantically identical for QR codes and shortlinks (same column, same redirect check). Unlike EditTargetUrl/EditLink which have distinct semantics, expiration has none. The caller is always owner-verified via `findByIdAndUserId`. The minor response-shape mismatch (QrItem vs ShortLinkItem) is not reachable via the UI. |
| GQ7 | What if `SET /api/qr/:id/expiration` body is `{}` (expiresAt missing)? | `@ValidateIf(o => o.expiresAt !== null)` evaluates to true when `expiresAt` is `undefined` (undefined !== null) → `@IsDateString()` runs → `undefined` fails → 400. Callers must send either a date string or explicit `null`. Correct behavior. |
