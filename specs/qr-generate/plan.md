# Plan — qr-generate

## Architecture

Feature slice: `QrModule` — mirrors `AuthModule` pattern. Six new file groups across four layers.

```
domain/qr/
  qr-code.ts                    # QrCode entity (static create(), private constructor)
  qr.repository.ts              # abstract QrRepository
  qr-image-generator.ts         # abstract QrImageGenerator (domain port)
  qr-storage.port.ts            # abstract QrStoragePort (domain port)

application/qr/
  generate-qr.use-case.ts       # GenerateQrUseCase — orchestrates generate → upload → save

infrastructure/qr/
  qrcode-image-generator.ts     # implements QrImageGenerator via `qrcode` npm
  minio-qr-storage.ts           # implements QrStoragePort via MinIO SDK

infrastructure/minio/
  minio.module.ts               # @Global() MinioModule — client + conditional health check
  minio-client.service.ts       # @Injectable(), OnModuleInit health check (prod-only)

infrastructure/persistence/
  entities/qr-code.orm-entity.ts
  repositories/typeorm-qr.repository.ts

interfaces/http/
  controllers/qr.controller.ts  # POST /api/qr, GET /api/qr/:id, GET /api/qr/:id/png|svg
  dto/create-qr.dto.ts
  modules/qr.module.ts

deploy/
  docker-compose.dev.yml        # MinIO local + app services for dev setup
```

`AppModule` gains two new imports: `MinioModule` (infra, global), `QrModule` (feature).

`DatabaseModule` stays unchanged — `autoLoadEntities: true` picks up `QrCodeOrmEntity` automatically.

---

## Contracts

### Domain ports

```typescript
// domain/qr/qr-image-generator.ts
export interface QrOptions {
  size: number;
  fgColor: string;
  bgColor: string;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
}
export abstract class QrImageGenerator {
  abstract generate(encodedContent: string, options: QrOptions): Promise<{ png: Buffer; svg: string }>;
}

// domain/qr/qr-storage.port.ts
// Named methods keep MinIO key format encapsulated in infrastructure.
// Controller passes only the QR id; implementation knows qr/{id}/qr.png format.
export abstract class QrStoragePort {
  abstract uploadPng(id: string, buffer: Buffer): Promise<void>;
  abstract uploadSvg(id: string, content: string): Promise<void>;
  abstract streamPng(id: string): Promise<NodeJS.ReadableStream>;
  abstract streamSvg(id: string): Promise<NodeJS.ReadableStream>;
  abstract exists(id: string): Promise<boolean>;
}

// domain/qr/qr.repository.ts
export abstract class QrRepository {
  abstract findById(id: string): Promise<QrCode | null>;
  abstract findByIdAndUserId(id: string, userId: string): Promise<QrCode | null>;
  abstract save(qr: QrCode): Promise<void>;
}
```

### Use case

```typescript
// application/qr/generate-qr.use-case.ts
export interface GenerateQrCommand {
  userId: string;
  contentType: 'url' | 'text';
  content: string;        // target URL (url type) or plain text (text type)
  size: number;
  fgColor: string;
  bgColor: string;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
  frontendUrl: string;    // passed by controller from ConfigService — use case stays framework-free
}
export interface GenerateQrResult {
  qr: QrCode;
}
class GenerateQrUseCase {
  async execute(cmd: GenerateQrCommand): Promise<GenerateQrResult>
}
```

Use case logic:
1. `id = crypto.randomUUID()` (Node built-in, no `uuid` dep)
2. `encodedContent = cmd.contentType === 'url' ? \`${cmd.frontendUrl}/r/${id}\` : cmd.content`
3. `{ png, svg } = await generator.generate(encodedContent, options)`
4. `await storage.uploadPng(id, png)` then `await storage.uploadSvg(id, svg)` — if either throws → propagate (controller → 500, no DB write)
5. `qr = QrCode.create({ id, userId, contentType, content, size, fgColor, bgColor, errorCorrection, createdAt: new Date() })`
6. `await repository.save(qr)`
7. Return `{ qr }`

### HTTP endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/qr` | required | Create QR → 201 |
| GET | `/api/qr/:id` | required (owner) | Get metadata → 200 |
| GET | `/api/qr/:id/png` | `@Public()` | Stream PNG → 200 |
| GET | `/api/qr/:id/svg` | `@Public()` | Stream SVG → 200 |

**Response shape (POST + GET metadata):**
```json
{
  "id": "uuid-v4",
  "userId": "sub",
  "contentType": "url",
  "content": "https://example.com",
  "size": 1024,
  "fgColor": "#000000",
  "bgColor": "#FFFFFF",
  "errorCorrection": "M",
  "createdAt": "2026-07-19T00:00:00.000Z",
  "pngUrl": "/api/qr/{id}/png",
  "svgUrl": "/api/qr/{id}/svg"
}
```

**CreateQrDto** (class-validator):
```typescript
contentType: 'url' | 'text'   // @IsIn(['url', 'text'])
content: string               // @IsNotEmpty()
                              // + @IsUrl({ protocols: ['http','https'], require_protocol: true })
                              //   when contentType === 'url' (conditional validator)
size?: number                 // @IsOptional(), @IsInt(), @Min(128), @Max(4096), default 1024
fgColor?: string              // @IsOptional(), @Matches(/^#[0-9A-Fa-f]{6}$/), default '#000000'
bgColor?: string              // @IsOptional(), @Matches(/^#[0-9A-Fa-f]{6}$/), default '#FFFFFF'
errorCorrection?: string      // @IsOptional(), @IsIn(['L','M','Q','H']), default 'M'
```

Conditional URL validation via `@ValidateIf(o => o.contentType === 'url')` + `@IsUrl(...)`.

### MinioClientService

```typescript
@Injectable()
export class MinioClientService implements OnModuleInit {
  readonly client: Client;  // minio.Client
  readonly bucket: string;

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('NODE_ENV') !== 'production') return;
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) throw new Error(`MinIO bucket "${this.bucket}" not found — check MINIO_* env vars`);
  }
}
```

Dev setup: `docker-compose.dev.yml` provides a local MinIO instance. Health check skipped in non-production so dev can run without MinIO configured, but `docker-compose.dev.yml` is the recommended local setup.

---

## Data Model

### QrCode domain entity

```typescript
export interface QrCodeProps {
  id: string;
  userId: string;
  contentType: 'url' | 'text';
  content: string;
  size: number;
  fgColor: string;
  bgColor: string;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
  createdAt: Date;
}

export class QrCode {
  private constructor(private readonly props: QrCodeProps) {}
  static create(props: QrCodeProps): QrCode { return new QrCode(props); }
  // getters for all props
}
```

### SQLite table: `qr_codes`

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PK |
| `user_id` | TEXT | NOT NULL |
| `content_type` | TEXT | NOT NULL ('url' \| 'text') |
| `content` | TEXT | NOT NULL |
| `size` | INTEGER | NOT NULL |
| `fg_color` | TEXT | NOT NULL |
| `bg_color` | TEXT | NOT NULL |
| `error_correction` | TEXT | NOT NULL |
| `created_at` | DATETIME | NOT NULL |

Index: `(user_id, created_at DESC)` — added proactively for `qr-history` pagination. `synchronize: true` creates it at startup with zero migration cost.

### MinIO object layout

```
{MINIO_BUCKET}/
  qr/{id}/qr.png    ← PNG buffer, content-type image/png
  qr/{id}/qr.svg    ← SVG string, content-type image/svg+xml
```

### `docker-compose.dev.yml`

Provides:
- MinIO service (local, `localhost:9000` API + `localhost:9001` console)
- Backend dev service (optional — can use `npm run dev:backend` directly)

---

## Dependencies

### New production dependencies

| Package | Version | Last publish | Justification |
|---|---|---|---|
| `minio` | `^8.0.7` | 2026-02-27 | Official MinIO JS SDK — uploads, streams, health check. Swap path: `@aws-sdk/client-s3` (S3-compatible, only `MinioQrStorage` + `MinioClientService` change) |
| `qrcode` | `^1.5.4` | 2024-08-05 | PNG buffer + SVG string generation, ISO 18004, MIT. Swap path: `qr-image` or custom. Only `QrcodeImageGenerator` changes. |

Both wrapped behind domain ports (`QrImageGenerator`, `QrStoragePort`) — implementation swap = 1 file each, zero domain/application changes.

### New dev dependencies

| Package | Version | Justification |
|---|---|---|
| `@types/qrcode` | `^1.5.6` | TypeScript types for `qrcode` npm |

### No `uuid` dependency

`crypto.randomUUID()` built-in Node ≥ 14.17 (Node 26 confirmed). No extra dep.

### Existing touched

- `AppModule` — adds `MinioModule` + `QrModule` imports
- `.env.example` — all MinIO vars already present; no new vars

---

## Alternatives Considered

### 1. Client-side QR generation (rejected)
Generate QR in browser, skip server storage. Instant UX, no MinIO needed.
**Rejected**: PRD requires server-side PNG+SVG stored in MinIO for proxy routes and `/q/{id}` public page. AC5/6/8/9 impossible client-side.

### 2. `@aws-sdk/client-s3` instead of `minio` npm (rejected)
MinIO is S3-compatible; AWS SDK works against it.
**Rejected**: `minio` npm is the official SDK for this backend, lighter, project is MinIO-first (Litestream uses same MinIO). Both wrapped behind `QrStoragePort` — swap cost is one file if needed.

### 3. Inject `ConfigService` into `GenerateQrUseCase` (rejected)
Use case reads `FRONTEND_URL` directly from `ConfigService`.
**Rejected**: `ConfigService` is NestJS infrastructure. Application layer must depend only on domain. Controller passes `frontendUrl` in the command — mirrors `callbackUrl()` pattern in `AuthController`.

### 4. `streamFile(key: string)` on `QrStoragePort` (rejected)
Single method, controller builds the MinIO key.
**Rejected**: MinIO key format (`qr/{id}/qr.png`) would leak into the HTTP controller layer. Named methods `streamPng(id)` / `streamSvg(id)` keep the key convention inside `MinioQrStorage`. Format change = 1 infra file, not the controller.

### 5. MinIO health check always active (rejected)
Fail startup unconditionally if MinIO unreachable, even in dev.
**Rejected by user**: health check production-only (`NODE_ENV === 'production'`). Dev setup provided by `docker-compose.dev.yml` — using it is the recommended path, but not forced.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| MinIO upload timeout causes > 2s response | Medium | Medium | Local MinIO on same host should be < 100ms; flag against PRD metric |
| `qrcode` SVG contains external refs | Low | Low | Inspect output once; serve with `Content-Security-Policy` if needed |
| 4096×4096 PNG ~1–4MB in memory | Low | Low | Acceptable for personal use |
| Dev without `docker-compose.dev.yml` setup — MinIO calls fail at runtime | Medium | Low | Health check skipped in dev; first `/api/qr` call fails with 500 — clear error |

---

## Grill Log

| Decision | Question | Resolution |
|---|---|---|
| `minio` + `qrcode` deps | Abandonment risk? Could this be done without? | Both wrapped behind domain ports — swap = 1 file each. `minio` active (Feb 2026), `qrcode` active (Aug 2024). Approved. |
| Abstraction level | Swap deps or DIY by design? | Domain ports (`QrImageGenerator`, `QrStoragePort`) already enforce this. NestJS module wires `useClass` — swap by config. No change needed. |
| `QrStoragePort` method shape | `streamFile(key)` vs named methods? | Named methods (`streamPng(id)`, `streamSvg(id)`, `exists(id)`) — MinIO key format stays in infra, not in controller. |
| Proactive index | YAGNI vs zero-cost now? | Added now — `synchronize: true` makes it free. Avoids touching schema when `qr-history` is built. |
| MinIO health check scope | Always vs prod-only? | Prod-only (`NODE_ENV === 'production'` guard). Dev setup via `docker-compose.dev.yml` (added to scope). |
