# Plan — qr-history

## Architecture

Two new endpoints added to `QrController` (same `/api/qr` prefix, same module):
- `GET /api/qr` — paginated list (authenticated)
- `DELETE /api/qr/:id` — delete QR + MinIO files (authenticated, owner-only)

No new module. Changes spread across domain, application, infrastructure, and the existing HTTP layer:

```
domain/qr/
  qr.repository.ts          ← add findAllByUserId()
  qr-storage.port.ts        ← add delete(id)

application/qr/
  delete-qr.use-case.ts     ← NEW
  list-qr.use-case.ts       ← NEW (or inline in controller — see JC1)

infrastructure/qr/
  minio-qr-storage.ts       ← implement delete(id)

infrastructure/persistence/repositories/
  typeorm-qr.repository.ts  ← implement findAllByUserId() + deleteById()

interfaces/http/
  dto/list-qr.dto.ts        ← NEW: page, limit query params
  controllers/qr.controller.ts  ← add GET / and DELETE /:id handlers
  modules/qr.module.ts      ← add DeleteQrUseCase + ListQrUseCase providers
```

---

## Contracts

### Domain — `QrRepository` (extended)

```typescript
abstract class QrRepository {
  // ... existing ...
  abstract findAllByUserId(
    userId: string,
    options: { page: number; limit: number }
  ): Promise<{ items: QrCode[]; total: number }>;
  abstract deleteById(id: string, userId: string): Promise<boolean>;
  // returns false if not found / not owned (→ controller throws 404)
}
```

`deleteById` handles the DB-side only; storage delete is in the use case.

### Domain — `QrStoragePort` (extended)

```typescript
abstract class QrStoragePort {
  // ... existing ...
  abstract delete(id: string): Promise<void>;
  // implementation deletes both qr.png and qr.svg in parallel; swallows NotFound errors
}
```

### Use case — `DeleteQrUseCase`

```typescript
interface DeleteQrCommand { id: string; userId: string; }

// Logic (AC18 order):
// 1. repository.findByIdAndUserId(id, userId) → null → NotFoundException
// 2. void storage.delete(id)  — fire-and-forget (swallow errors)
//    Note: MinIO delete errors are logged but never thrown. DB delete always proceeds.
// 3. deleted = await repository.deleteById(id, userId)
// 4. if (!deleted) throw NotFoundException  (race: already deleted between step 1 and 3)
```

### Use case — `ListQrUseCase`

```typescript
interface ListQrCommand { userId: string; page: number; limit: number; }
interface ListQrResult { items: QrCode[]; total: number; page: number; limit: number; }

// Logic:
// 1. repository.findAllByUserId(userId, { page, limit })
// 2. return { items, total, page, limit }
```

### HTTP — `GET /api/qr`

Query params (via `ListQrDto`):
- `page`: integer, ≥ 1, default 1
- `limit`: integer, 1–100, default 20

Response 200:
```json
{
  "items": [{ "id": "...", "contentType": "url", "content": "https://exa…", "scanCount": 3, "createdAt": "...", "pngUrl": "/api/qr/…/png", "svgUrl": "/api/qr/…/svg", ... }],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

Content field truncated to 80 chars + `…` in `toListItemResponse()` (separate from existing `toResponse()`).

### HTTP — `DELETE /api/qr/:id`

Response: 204 No Content (no body).

---

## Data Model

No new tables or columns. Uses existing `qr_codes` table.

`findAllByUserId` implementation:
```typescript
const [items, total] = await this.repository.findAndCount({
  where: { userId },
  order: { createdAt: 'DESC' },
  skip: (page - 1) * limit,
  take: limit,
});
```

`deleteById` implementation:
```typescript
const result = await this.repository.delete({ id, userId });
return result.affected > 0;
```

---

## Dependencies

No new third-party libraries. All existing:
- `typeorm` — `findAndCount`, `delete`
- `@nestjs/common` — `Query`, `Delete`, `HttpCode`

---

## Alternatives Considered

### A. Inline list logic in controller (no `ListQrUseCase`)
The list is genuinely thin: call repo, return result. A dedicated use case adds 20 lines of boilerplate for a pass-through. Rejected: pattern consistency with `GenerateQrUseCase` wins; keeps controller zero-logic.

### B. `deletePng(id)` + `deleteSvg(id)` on `QrStoragePort`
Rejected in grill (OQ2): `delete(id)` encapsulates file layout. Use case calls one method, not two.

### C. `QrRepository.deleteById` returns `void`, throw from repo on not-found
Rejected: throwing from the repository leaks HTTP semantics (NotFoundException) into the domain. Returning `boolean` keeps the domain clean; controller/use-case decides the HTTP error.

### D. MinIO delete AFTER DB delete
Rejected per AC18: MinIO-first ensures we never have a DB entry pointing to missing files. Orphaned files (DB deleted, MinIO still present) are far less harmful than a ghost DB record causing 500s on proxy routes.

### E. Separate `HistoryModule` instead of extending `QrModule`
Rejected: the list and delete are operations on the same `QrCode` resource, same controller, same repository. A separate module would add cross-module dependency complexity for no architectural gain.

---

## Risks

| Risk | Mitigation |
|---|---|
| `findAndCount` slow on large `qr_codes` table | Existing index `(userId, createdAt)` covers the query exactly |
| MinIO delete partial failure (png deleted, svg fails) | Both keys attempted in `Promise.allSettled`; individual failures logged, not thrown |
| Race: delete between findByIdAndUserId and deleteById | `deleteById` returns false if `affected === 0`; use case throws NotFoundException; 404 is correct behavior |
| `Promise.allSettled` vs `Promise.all` in MinIO delete | Use `Promise.allSettled` — ensures both deletions are attempted even if first fails |

---

## Grill Log

| JC | Décision | Résolution | Date |
|---|---|---|---|
| JC1 | `ListQrUseCase` vs inline controller | **Use case conservé** — cohérence avec GenerateQrUseCase, testable sans NestJS | 2026-07-19 |
| JC2 | `Promise.all` vs `Promise.allSettled` dans MinioQrStorage.delete() | **`Promise.allSettled`** — les deux suppressions tentées même si l'une échoue; conforme AC15 best-effort | 2026-07-19 |
| JC3 | `toListItemResponse` séparé vs `toResponse` avec flag | **`toListItemResponse()` séparé** — pas de conditionnel dans toResponse(), formats liste et détail indépendants | 2026-07-19 |
