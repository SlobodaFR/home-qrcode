# Plan — logo-overlay

## Architecture

Feature lives entirely within the existing `QrModule` bounded context. No new module needed.

### New files

| Layer | File | Purpose |
|---|---|---|
| `domain/qr/` | `logo-compositor.port.ts` | Abstract port — composites logo onto QR PNG |
| `application/qr/` | `attach-logo.use-case.ts` | Orchestrates regenerate → composite → upload → persist |
| `infrastructure/qr/` | `sharp-logo-compositor.ts` | `sharp` implementation of `LogoCompositorPort` |

### Modified files

| File | Change |
|---|---|
| `domain/qr/qr-code.ts` | Add `encodedContent`, `hasLogo`, `logoMimeType`; add `withLogo()` method and `logoUrl` getter |
| `domain/qr/qr-storage.port.ts` | Add abstract `uploadLogo`, `streamLogo`; semantic enrichment of `delete` (logo included) |
| `infrastructure/qr/minio-qr-storage.ts` | Implement `uploadLogo`, `streamLogo`; extend `delete` to include logo key |
| `infrastructure/persistence/entities/qr-code.orm-entity.ts` | Add `encodedContent`, `hasLogo`, `logoMimeType` columns |
| `infrastructure/persistence/repositories/typeorm-qr.repository.ts` | Map new fields in `toDomain` and `save` |
| `application/qr/generate-qr.use-case.ts` | Pass `encodedContent` and `hasLogo: false` to `QrCode.create()` |
| `interfaces/http/controllers/qr.controller.ts` | Add `attachLogo` endpoint; add `streamLogo` endpoint; add `hasLogo`/`logoMimeType` to `toResponse` |
| `interfaces/http/qr.module.ts` | Register `LogoCompositorPort → SharpLogoCompositor`, `AttachLogoUseCase` |
| `frontend/src/infrastructure/api/qr-auth.client.ts` | Add `attachLogo(id, file)`, extend `QrItem` with `hasLogo`, `logoMimeType` |
| `frontend/src/application/hooks/useDashboard.ts` | Add `attachLogo` |
| `frontend/src/presentation/pages/DashboardPage.tsx` | Add logo upload button on `QrCard`; add correction-level notice in `CreateForm` |

### Layer discipline

- `LogoCompositorPort` — domain abstract class. Zero imports. Consistent with `QrImageGenerator` and `QrStoragePort` both living in `domain/qr/`.
- `SharpLogoCompositor` — infrastructure. Only place `sharp` is imported.
- `AttachLogoUseCase` — application. Depends on `QrRepository`, `QrImageGenerator`, `LogoCompositorPort`, `QrStoragePort` (all domain ports). ✓

## Contracts

### `LogoCompositorPort` (new — `domain/qr/logo-compositor.port.ts`)

```typescript
export abstract class LogoCompositorPort {
  // Resizes logo to 30% of qrPng width (preserving aspect ratio, preserving alpha),
  // then composites it at center of qrPng.
  abstract composite(qrPng: Buffer, logo: Buffer): Promise<Buffer>;
}
```

### `AttachLogoCommand` / `AttachLogoResult`

```typescript
export interface AttachLogoCommand {
  id: string;
  userId: string;
  logoBuffer: Buffer;
  logoMimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  frontendUrl: string; // from ConfigService in controller — same pattern as GenerateQrUseCase
}

export interface AttachLogoResult {
  qr: QrCode;
}
```

### `AttachLogoUseCase.execute()` flow

1. `qrRepository.findByIdAndUserId(id, userId)` → 404 if null
2. If `qr.hasLogo` → throw `ConflictException` (409)
3. Resolve `encodedContent`:
   - If `qr.encodedContent` is set → use it
   - If null + `contentType === 'url'` → `${frontendUrl}/r/${id}`
   - If null + `contentType === 'text'` → `qr.content`
   - If null + wifi/email/vcard → throw `UnprocessableEntityException` (422)
4. `effectiveCorrection = ['L', 'M'].includes(qr.errorCorrection) ? 'Q' : qr.errorCorrection`
5. `{ png } = await generator.generate(encodedContent, { size, fgColor, bgColor, errorCorrection: effectiveCorrection })`
   — SVG result discarded; not re-uploaded
6. `compositedPng = await compositor.composite(png, logoBuffer)`
7. `await storage.uploadLogo(id, logoBuffer, logoMimeType)` — raw logo stored
8. `await storage.uploadPng(id, compositedPng)` — overwrites existing PNG
9. `updatedQr = qr.withLogo(effectiveCorrection, logoMimeType)`
10. `await qrRepository.save(updatedQr)`
11. Return `{ qr: updatedQr }`

Steps 7–10: if any throws, propagate 503. No partial state persisted.

### `QrStoragePort` additions

```typescript
abstract uploadLogo(id: string, buffer: Buffer, mimeType: string): Promise<void>;
abstract streamLogo(id: string): Promise<NodeJS.ReadableStream>;
// delete(id) — signature unchanged; implementation adds logo key to Promise.allSettled
```

### MinIO keys

| Asset | Key |
|---|---|
| PNG | `{assetsPath}/{id}/qr.png` (unchanged) |
| SVG | `{assetsPath}/{id}/qr.svg` (unchanged) |
| Logo | `{assetsPath}/{id}/logo` (no extension — Content-Type stored as MinIO metadata) |

### New API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/qr/:id/logo` | JWT | Attach logo (multipart, `logo` field, max 2 MB) |
| `GET` | `/api/qr/:id/logo` | `@Public()` | Stream logo bytes |

`POST /api/qr/:id/logo` uses `@UseInterceptors(FileInterceptor('logo', { limits: { fileSize: 2_097_152 } }))` with `ParseFilePipe` + `FileTypeValidator` at the HTTP boundary:

```typescript
@UploadedFile(
  new ParseFilePipe({
    validators: [new FileTypeValidator({ fileType: /^image\/(png|jpeg|webp)$/ })],
  }),
) logo: Express.Multer.File
```

File size enforced by `FileInterceptor` limits (→ 413). MIME type enforced by `ParseFilePipe` (→ 400). Use case receives pre-validated `logoBuffer` and `logoMimeType` — no validation logic inside application layer. Compliant with CLAUDE.md "DTOs validated at the HTTP boundary only".

### `QrCode` domain entity additions

```typescript
// Props additions
encodedContent: string | null;   // null only for records pre-dating this feature
hasLogo: boolean;                 // default false
logoMimeType: string | null;      // null when no logo

// New method
withLogo(effectiveCorrection: 'L' | 'M' | 'Q' | 'H', mimeType: string): QrCode

// New getter
get logoUrl(): string { return `/api/qr/${this.props.id}/logo`; }
```

### `QrItem` response additions

```typescript
hasLogo: boolean;
logoMimeType: string | null;
// logoUrl not in response — frontend constructs it as /api/qr/:id/logo when hasLogo: true
```

## Data Model

### `qr_codes` table — new columns

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `encoded_content` | TEXT | YES | NULL | Null for records created before this feature |
| `has_logo` | BOOLEAN | NO | FALSE | |
| `logo_mime_type` | TEXT | YES | NULL | e.g. `image/png` |

No DDL migration file. SQLite `synchronize: true` adds columns automatically.

**Backward compat**: existing rows get `encoded_content = NULL`, `has_logo = FALSE`, `logo_mime_type = NULL`. `AttachLogoUseCase` reconstructs `encodedContent` for url/text types; rejects wifi/email/vcard with 422 (see spec EC1).

### ORM entity additions (`QrCodeOrmEntity`)

```typescript
@Column({ type: 'text', name: 'encoded_content', nullable: true })
encodedContent!: string | null;

@Column({ type: 'boolean', name: 'has_logo', default: false })
hasLogo!: boolean;

@Column({ type: 'text', name: 'logo_mime_type', nullable: true })
logoMimeType!: string | null;
```

### Repository mapper (`toDomain`, `save`) — add all three fields

## Dependencies

### New — production

| Package | Version | Reason |
|---|---|---|
| `sharp` | `^0.34` | PNG compositing. Prebuilt binaries for linux-x64 / linux-arm64 on `node:26-bookworm-slim`. No Dockerfile changes needed — existing `python3 make g++` build tools cover native build fallback. |

### New — devDependencies

| Package | Version | Reason |
|---|---|---|
| `@types/sharp` | `^0.31` | TypeScript types for `sharp` |
| `@types/multer` | `^1.4` | `Express.Multer.File` type for `FileInterceptor` (`@nestjs/platform-express` bundles `multer` at runtime but does not install types) |

### No new runtime deps for frontend

Logo attach uses `FormData` + `fetch` — no new library.

## Alternatives Considered

### Alt 1 — Inline multipart on `POST /api/qr` (rejected)
Attaching the logo at creation time via multipart would require `@Transform(() => Number)` on all numeric DTO fields (`size`) since form fields arrive as strings. The existing `CreateQrDto` is tested; mutating it to handle both JSON and multipart risks breaking the 52 passing DTO tests. **Separate post-creation endpoint keeps `POST /api/qr` as pure JSON. Zero regression risk.** (Spec OQ1.)

### Alt 2 — Composite onto existing PNG without correction level change (rejected)
Compositing a logo onto a QR generated at L or M would occlude ~9% of the module area. L provides only 7% error correction capacity — the result would be unreadable. PNG must be regenerated at the effective correction level. (Spec OQ5.)

### Alt 3 — Separate `generatePng()` method on `QrImageGenerator` (rejected)
`AttachLogoUseCase` only needs the PNG output; the SVG regenerated by `generate()` is discarded. A dedicated `generatePng()` would avoid the wasted SVG pass. Rejected: SVG generation is synchronous and fast (`qrcode.toString` with `type: 'svg'`); the API change across domain, application, infrastructure, and tests adds more complexity than the performance gain justifies for a personal app. Judgment call.

### Alt 4 — Store logo MinIO key with extension (`logo.png`, `logo.jpg`) (rejected)
Key `{assetsPath}/{id}/logo.{ext}` would require storing the ext (or deriving it from `logoMimeType`) when deleting or streaming. Key `{assetsPath}/{id}/logo` (no extension) is simpler: the object exists or it doesn't, and the Content-Type is stored as MinIO metadata. Same information, one fewer derivation step. `logoMimeType` stored in DB already handles the Content-Type header in the proxy route.

### Alt 5 — `LogoCompositorPort` in `application` layer (rejected)
CLAUDE.md says "application — use cases, ports" which technically permits it. But `QrImageGenerator` and `QrStoragePort` — both equally non-domain — live in `domain/qr/`. Consistency with the established convention wins. Mixing port location would require explaining the split. Judgment call.

### Alt 6 — Store full structured fields (ssid, password, etc.) for regeneration (rejected)
Would solve the `encodedContent` backward compat problem for wifi/email/vcard without needing a reconstruction formula, but would mean storing wifi passwords and email bodies in plaintext in a second column alongside the existing `content` summary. `encodedContent` stores the same data (the password is already implicitly in the QR image), so the privacy delta is zero. `encodedContent` is simpler (one column covers all types) and is directly usable by `QrImageGenerator` without re-encoding. (Spec implied gap X.)

## Risks

| Risk | Mitigation |
|---|---|
| `sharp` native binary mismatch on ARM64 (e.g. M-series Mac dev vs linux/arm64 container) | `sharp` ships separate prebuilts per platform; `npm install` downloads the correct one. Dev machine and container both handled automatically. |
| SVG left stale after logo attach (PNG regenerated, SVG not) | By design (Option A). SVG is the clean logo-free vector — both download links remain visible. When `hasLogo: true`, SVG link is labelled "SVG (sans logo)" in the frontend to prevent confusion. |
| Partial MinIO state on failed attach (logo uploaded, PNG overwrite fails) | Orphaned logo key in MinIO. Acceptable for a personal app — no user-visible corruption (DB not updated, `hasLogo` stays false). Can be cleaned up manually or by a future maintenance job. |
| `encodedContent` null for old wifi/email/vcard QRs | Returns 422 with clear message. User must recreate. No silent failure. |
| `sharp` adds ~10 MB to Docker image | Acceptable for a personal app. Prebuilt binaries are self-contained. |

## Grill Log

| # | Decision | Resolution |
|---|---|---|
| G1 | SVG behavior after logo attach — keep both links, hide SVG, or regenerate SVG at Q? | **Option A**: keep both links; label SVG as "SVG (sans logo)" when `hasLogo: true`. SVG is a useful clean vector artifact. |
| G2 | MIME validation location — use case vs HTTP boundary | Moved to controller via `ParseFilePipe` + `FileTypeValidator`. CLAUDE.md: "DTOs validated at the HTTP boundary only." Use case receives pre-validated input. |
