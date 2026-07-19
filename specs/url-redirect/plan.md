# Plan — url-redirect

## Architecture

Feature adds two concerns to the existing structure:

1. **Redirect route** (`GET /r/:id`) — new `RedirectModule` + `RedirectController` + `RedirectUseCase` in `application/redirect/`. Cannot live in `QrModule` because the URL prefix is `/r/` not `/api/qr/`, and the feature slice rule (CLAUDE.md) requires separate modules per feature.

2. **Edit target URL** (`PATCH /api/qr/:id`) — added to existing `QrController` (same resource, same prefix). Use case lives in `application/qr/edit-target-url.use-case.ts`. Stays in `QrModule`.

3. **Scan counter** — additive change to `domain/qr/qr-code.ts`, `qr-code.orm-entity.ts`, `qr.repository.ts`, and `typeorm-qr.repository.ts`. No new layer; existing infrastructure extended.

Layer placement:
```
domain/qr/              ← QrCode (+ scanCount getter + withContent()), QrRepository (+ incrementScanCount)
application/qr/         ← EditTargetUrlUseCase
application/redirect/   ← RedirectUseCase
infrastructure/persistence/entities/   ← QrCodeOrmEntity (+ scan_count column)
infrastructure/persistence/repositories/  ← TypeOrmQrRepository (+ incrementScanCount impl)
interfaces/http/controllers/  ← QrController (+ PATCH), RedirectController (new)
interfaces/http/dto/    ← EditTargetUrlDto (new)
interfaces/http/modules/ ← RedirectModule (new); QrModule (+ EditTargetUrlUseCase provider)
app.module.ts           ← + RedirectModule import
```

---

## Contracts

### Domain — `QrCode` entity (modified)

```typescript
interface QrCodeProps {
  // ... existing fields ...
  scanCount: number;   // NEW: default 0 at creation
}

class QrCode {
  get scanCount(): number { ... }
  withContent(content: string): QrCode { ... }  // returns new instance, preserves all other props
}
```

### Domain — `QrRepository` (modified)

```typescript
abstract class QrRepository {
  // ... existing methods ...
  abstract incrementScanCount(id: string): Promise<void>;
}
```

Implementation uses TypeORM `repository.increment({ id }, 'scanCount', 1)` — atomic `UPDATE SET scan_count = scan_count + 1`, no read-modify-write.

### Use case — `RedirectUseCase`

```typescript
interface RedirectCommand { id: string; }
interface RedirectResult { targetUrl: string; }

// Logic:
// 1. qrRepository.findById(id) → null → throw NotFoundException
// 2. qr.contentType !== 'url' → throw NotFoundException (text QRs have no redirect)
// 3. void qrRepository.incrementScanCount(id)  // fire, no await
// 4. return { targetUrl: qr.content }
```

### Use case — `EditTargetUrlUseCase`

```typescript
interface EditTargetUrlCommand {
  id: string;
  userId: string;
  content: string;
}
interface EditTargetUrlResult { qr: QrCode; }

// Logic:
// 1. findByIdAndUserId(id, userId) → null → throw NotFoundException
// 2. qr.contentType !== 'url' → throw UnprocessableEntityException
// 3. updated = qr.withContent(content)
// 4. repository.save(updated)
// 5. return { qr: updated }
```

### HTTP — `PATCH /api/qr/:id`

Request body: `{ content: string }` — validated as URL (http/https, required).

Response: 200 with same shape as `POST /api/qr` (all QrCode fields + `scanCount`).

### HTTP — `GET /r/:id`

No auth guard (`@Public()`). Response: 302 with `Location` header. No response body.

### `GET /api/qr/:id` response (modified from `qr-generate`)

Add `scanCount: number` field to the `toResponse()` function and its callers.

---

## Data Model

### `qr_codes` table — new column

```sql
scan_count INTEGER NOT NULL DEFAULT 0
```

TypeORM migration: TypeORM `synchronize: true` in dev will auto-add the column. In production the migration is handled by the same synchronize path (single container, no schema versioning yet per current setup). The column has a `DEFAULT 0` so existing rows (if any) get `0`.

### ORM entity change

```typescript
@Column({ type: 'integer', name: 'scan_count', default: 0 })
scanCount!: number;
```

### `toDomain` + `save` in `TypeOrmQrRepository` — updated to include `scanCount`

---

## Dependencies

No new third-party libraries. All dependencies already in place:
- `typeorm` — `repository.increment()` for atomic scan count update
- `@nestjs/common` — `UnprocessableEntityException` (HTTP 422)

---

## Alternatives Considered

### A. Sync scan increment vs. async fire-and-forget
Resolved in grill (OQ2): **async**. Sync would work (SQLite write < 1ms) but async is the agreed approach: 302 sent immediately, increment runs in background. Error is swallowed (logged if needed) to avoid increment failure blocking the redirect.

### B. Separate `scans` table
Resolved in grill (OQ1): **column on `qr_codes`**. No v1 benefit from a separate table; column is zero-join on redirect.

### C. PATCH endpoint in `RedirectController` instead of `QrController`
Rejected: `PATCH /api/qr/:id` is modifying a `QrCode` resource. Its controller is `QrController`. Adding it to `RedirectController` would split a resource across two controllers, breaking REST convention. The `url-redirect` feature tag is about the purpose, not the HTTP location.

### D. `updateContent(id, userId, content)` method on `QrRepository`
Rejected in favor of `withContent()` + `save()`: keeps the repository interface lean (no partial-update methods that would need to return the full entity anyway), and the immutable entity pattern (`withContent()` returning a new `QrCode`) is consistent with the domain model.

### E. `RedirectUseCase` inlined in `RedirectController`
Rejected: all business logic belongs in application layer (CLAUDE.md convention). The redirect logic (find → type check → increment → return URL) has enough conditions to warrant a use case, and it makes unit testing the logic without NestJS overhead trivial.

---

## Risks

| Risk | Mitigation |
|---|---|
| `incrementScanCount` fire-and-forget swallows errors silently | Catch and log the error (no throw); counter accuracy is best-effort per AC6 |
| `withContent()` doesn't preserve `scanCount` → zero-resets counter on edit | Must pass all existing props (including `scanCount`) when constructing the new entity in `withContent()` |
| `save()` in TypeOrmQrRepository currently omits `scanCount` → writes 0 on every save | Must update `save()` to include `scanCount: qr.scanCount` |

---

## Grill Log

| JC | Decision | Resolution | Date |
|---|---|---|---|
| JC1 | `RedirectUseCase` vs. inline controller logic | **Keep use case** — consistency with `GenerateQrUseCase` pattern; testable without NestJS; 3-line logic doesn't disqualify it | 2026-07-19 |
| JC2 | `RedirectModule` imports `QrModule` for `QrRepository` | **Standard NestJS cross-module import** — `QrModule` already exports `QrRepository`; duplication alternative rejected | 2026-07-19 |
| JC3 | 422 vs. 400 for PATCH on text-type QR | **422 Unprocessable Entity** — semantically valid request but meaningless operation for the resource's content type | 2026-07-19 |
