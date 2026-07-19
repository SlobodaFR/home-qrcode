# Plan — extended-content-types

## Architecture

All changes live in the existing `QrModule` feature slice. No new module needed.

### Backend layers touched

| Layer | File(s) | Change |
|---|---|---|
| `domain/qr` | `qr-code.ts` | Extend `contentType` union to include 3 new values |
| `application/qr` | `generate-qr.use-case.ts` | Extend command, add encoding branch per type |
| `application/qr` | `qr-content.encoder.ts` *(new)* | Pure encoding functions (wifi/email/vcard → string) |
| `infrastructure/persistence/entities` | `qr-code.orm-entity.ts` | Update TS type annotation (no DDL change — SQLite TEXT, `synchronize: true`) |
| `interfaces/http/dto` | `create-qr.dto.ts` | Add new fields with `@ValidateIf` guards; update `@IsIn` |
| `interfaces/http/controllers` | `qr.controller.ts` | Pass structured fields through to use case command |

### Frontend layers touched

| Layer | File(s) | Change |
|---|---|---|
| `infrastructure/api` | `qr-auth.client.ts` | Change `createQrCode` from `(contentType, content)` to `(payload: CreateQrPayload)` |
| `application/hooks` | `useDashboard.ts` | Update `create` signature to accept `CreateQrPayload` |
| `presentation/pages` | `DashboardPage.tsx` | Expand `CreateForm` with 3 new type-specific field sets |

## Contracts

### New encoding utility (`application/qr/qr-content.encoder.ts`)

Three pure functions, one per structured type. No I/O — fully unit-testable. The use case switches on `contentType` and calls the right encoder.

```typescript
export type ContentType = 'url' | 'text' | 'wifi' | 'email' | 'vcard';

export interface WifiFields  { ssid: string; security: 'WPA' | 'WEP' | 'nopass'; password?: string }
export interface EmailFields { to: string; subject?: string; body?: string }
export interface VcardFields { name: string; phone?: string; email?: string; org?: string }

export function encodeWifi(fields: WifiFields): string
export function encodeEmail(fields: EmailFields): string
export function encodeVcard(fields: VcardFields): string
```

Location: `application/qr/qr-content.encoder.ts` (application layer utility, zero framework imports). _(JC1 resolved: application layer wins over domain value object — encoding is a formatting concern driven by external specs, not domain behaviour.)_

### Updated `GenerateQrCommand` — discriminated union

TypeScript-enforced: the compiler guarantees structured fields are present for their type. No runtime assertions needed. _(JC2 resolved: discriminated union over flat optionals.)_

```typescript
type DisplayOptions = {
  size: number; fgColor: string; bgColor: string;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
};
type BaseCmd = { userId: string; frontendUrl: string } & DisplayOptions;

export type GenerateQrCommand =
  | (BaseCmd & { contentType: 'url';   content: string })
  | (BaseCmd & { contentType: 'text';  content: string })
  | (BaseCmd & { contentType: 'wifi';  wifi: WifiFields })
  | (BaseCmd & { contentType: 'email'; emailFields: EmailFields })
  | (BaseCmd & { contentType: 'vcard'; vcard: VcardFields });
```

`content` stored in DB derived in use case:
- `wifi` → `cmd.wifi.ssid`
- `email` → `cmd.emailFields.to`
- `vcard` → `cmd.vcard.name`
- `url`/`text` → `cmd.content`

### Updated `CreateQrDto` (flat, `@ValidateIf` pattern)

New optional fields added alongside existing ones:
```
ssid, security, password   ← guarded with @ValidateIf(o => o.contentType === 'wifi')
to, subject, body          ← guarded with @ValidateIf(o => o.contentType === 'email')
name, phone, vcardEmail, org ← guarded with @ValidateIf(o => o.contentType === 'vcard')
```

`content` gains an additional `@ValidateIf` guard: only required when `contentType` is `'url'` or `'text'`.

Note: the vcard email sub-field is named `vcardEmail` in the DTO to avoid clash with the `'email'` content type string.

### Updated `POST /api/qr` request body

```json
// wifi
{ "contentType": "wifi", "ssid": "MyNetwork", "security": "WPA", "password": "secret" }
// email
{ "contentType": "email", "to": "user@example.com", "subject": "Hi" }
// vcard
{ "contentType": "vcard", "name": "Jane Doe", "phone": "+33612345678" }
```

### Frontend `CreateQrPayload` type (`qr-auth.client.ts`)

```typescript
export type CreateQrPayload =
  | { contentType: 'url';   content: string }
  | { contentType: 'text';  content: string }
  | { contentType: 'wifi';  ssid: string; security: 'WPA' | 'WEP' | 'nopass'; password?: string }
  | { contentType: 'email'; to: string; subject?: string; body?: string }
  | { contentType: 'vcard'; name: string; phone?: string; email?: string; org?: string };

export async function createQrCode(payload: CreateQrPayload): Promise<QrItem>
```

## Data Model

No DDL migration. `content_type` column is `TEXT` in SQLite — TypeScript union widening is invisible to the DB.

Only TypeScript type annotations change:
- `QrCode.contentType`: `'url' | 'text'` → `'url' | 'text' | 'wifi' | 'email' | 'vcard'`
- `QrCodeOrmEntity.contentType`: same

`content` column continues to store a human-readable string for all types.

## Dependencies

No new third-party libraries. Encoding for all three types is pure string formatting — no external lib needed.

## Alternatives Considered

**Encoding location: domain value object vs application utility**
Rejected putting encoding in `domain/qr/` as a `QrContentEncoder` class. The domain would gain knowledge of three different content-type structs with no domain behaviour — it would be a helper bag, not a real value object. A pure utility function in `application/qr/qr-content.encoder.ts` is simpler and still fully testable. _Judgment call._

**DTO: discriminated union DTOs vs flat with `@ValidateIf`**
Rejected separate DTO classes per type (e.g. `CreateWifiQrDto`, `CreateEmailQrDto`) with a union. `class-validator` doesn't support `@Type(() => ...)` discriminated union on a top-level payload cleanly without a wrapper. The existing codebase already uses `@ValidateIf` for conditional validation on `content` — extending that pattern is consistent and avoids a new decorator pattern.

**Frontend payload: separate `create` signatures per type**
Rejected overloaded function signatures (`createWifiQrCode(...)`, etc.). A single discriminated union payload type is the idiomatic TypeScript approach and keeps `useDashboard` and `CreateForm` simple.

**Storing encoded QR string vs human-readable summary in `content`**
Rejected storing the full encoded string (e.g. `WIFI:T:WPA;S:MyNet;P:secret;;`). The list preview would need to parse it back. Human-readable summary is simpler, consistent with the 80-char truncation, and editing is out of scope.

## Grill Log

| ID | Decision | Resolution |
|---|---|---|
| JC1 | Encoding location: application utility vs domain value object | Application layer (`application/qr/qr-content.encoder.ts`). Encoding is a formatting concern driven by external specs (Wi-Fi QR, RFC 2368, vCard 3.0), not domain behaviour. Three separate pure functions, one per type. |
| JC2 | `GenerateQrCommand`: flat optional fields vs discriminated union | Discriminated union. TypeScript enforces presence of structured fields at compile time. No runtime assertions needed. |
| JC3 | Flat DTO with `@ValidateIf` vs discriminated union DTOs | Flat confirmed. Rejection reason holds: class-validator discriminated unions require custom `@Type` discriminator not used elsewhere. `@ValidateIf` is the existing pattern and sufficient. |

## Risks

| Risk | Mitigation |
|---|---|
| Wi-Fi special-char escaping incorrect → scanner fails | Unit test each escape character in `qr-content.encoder.spec.ts` |
| `@ValidateIf` cross-field (password required if security ≠ nopass) | Custom `@ValidateIf` + `@IsNotEmpty` combination — tested in DTO spec |
| `vcardEmail` naming confusion in DTO vs `contentType = 'email'` | Naming documented in contracts; rename field `vcardEmail` in DTO to avoid collision |
| ORM type annotation mismatch on old rows | SQLite TEXT is untyped; no constraint enforced — no runtime error possible |
