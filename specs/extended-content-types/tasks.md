# Tasks — extended-content-types

## Tests

### Group 1 — `encodeWifi()` (`backend/src/application/qr/qr-content.encoder.spec.ts`)

1. ✅ [unit] should return WIFI string with T:WPA for minimal WPA input — TPP: constant — FLFI: create `encodeWifi` returning hardcoded `WIFI:T:WPA;S:MyNet;P:secret;;`
2. ✅ [unit] should interpolate ssid and password from fields — TPP: variable — FLFI: replace hardcoded values with `fields.ssid` and `fields.password`
3. ✅ [unit] should encode nopass with empty P segment — TPP: conditional — FLFI: branch on `security === 'nopass'` → `P:;;`
4. ✅ [unit] should ignore password when security is nopass — TPP: conditional — FLFI: same branch omits password interpolation entirely
5. ✅ [unit] should use WEP in T segment for WEP security — TPP: conditional — FLFI: pass `fields.security` directly into the template
6. ✅ [unit] should escape backslash in ssid — TPP: collection — FLFI: add escape helper replacing `\` → `\\` applied to ssid and password
7. ✅ [unit] should escape semicolon in password — TPP: collection — FLFI: extend escape helper to replace `;` → `\;`
8. ✅ [unit] should escape comma in ssid — TPP: collection — FLFI: extend escape helper to replace `,` → `\,`
9. ✅ [unit] should escape double-quote in ssid — TPP: collection — FLFI: extend escape helper to replace `"` → `\"`

### Group 2 — `encodeEmail()` (`backend/src/application/qr/qr-content.encoder.spec.ts`)

10. ✅ [unit] should return bare MAILTO:{to} when only to is given — TPP: constant — FLFI: create `encodeEmail` returning `MAILTO:${fields.to}` with no query string
11. ✅ [unit] should append ?subject={subject} when subject is present — TPP: conditional — FLFI: build URLSearchParams conditionally, append when subject defined
12. ✅ [unit] should append ?body={body} when body is present — TPP: conditional — FLFI: same conditional-param pattern for body
13. ✅ [unit] should include both subject and body joined with & — TPP: conditional — FLFI: join all present params with `&` in query string

### Group 3 — `encodeVcard()` (`backend/src/application/qr/qr-content.encoder.spec.ts`)

14. ✅ [unit] should return vCard 3.0 with only FN when only name given — TPP: constant — FLFI: create `encodeVcard` returning BEGIN/VERSION/FN/END with hardcoded name
15. ✅ [unit] should include TEL line when phone present — TPP: conditional — FLFI: push `TEL:${fields.phone}` to lines array when phone defined
16. ✅ [unit] should include EMAIL line when email present — TPP: conditional — FLFI: push `EMAIL:${fields.email}` to lines array when email defined
17. ✅ [unit] should include ORG line when org present — TPP: conditional — FLFI: push `ORG:${fields.org}` to lines array when org defined
18. ✅ [unit] should omit all optional lines when no optional fields given — TPP: conditional — FLFI: verify only BEGIN/VERSION/FN/END in output when all optionals absent

### Group 4 — `QrCode` domain entity (`backend/src/domain/qr/qr-code.spec.ts`)

19. ✅ [unit] should accept contentType 'wifi' in QrCode.create and return it via getter — TPP: constant — FLFI: extend `contentType` union in `QrCodeProps` and getter to include `'wifi' | 'email' | 'vcard'`
20. ✅ [unit] should accept contentType 'email' in QrCode.create — TPP: variable — FLFI: same union change, no new code beyond test 19's change
21. ✅ [unit] should accept contentType 'vcard' in QrCode.create — TPP: variable — FLFI: same

### Group 5 — `CreateQrDto` validation (`backend/src/interfaces/http/dto/create-qr.dto.spec.ts`)

22. ✅ [unit] should accept valid wifi payload with WPA security and password — TPP: constant — FLFI: add `ssid`, `security`, `password` fields to DTO with `@ValidateIf(o => o.contentType === 'wifi')` guards; extend `@IsIn` to include `'wifi'`
23. ✅ [unit] should reject wifi payload missing ssid — TPP: conditional — FLFI: `@IsNotEmpty` on `ssid` guarded by `contentType === 'wifi'`
24. ✅ [unit] should reject wifi WPA payload missing password — TPP: conditional — FLFI: `@IsNotEmpty` on `password` guarded by `contentType === 'wifi' && security !== 'nopass'`
25. ✅ [unit] should accept wifi nopass without password — TPP: conditional — FLFI: `@ValidateIf` guard for password skips check when `security === 'nopass'`
26. ✅ [unit] should accept valid email payload with to only — TPP: constant — FLFI: add `to` field with `@IsEmail` guarded by `contentType === 'email'`; extend `@IsIn`
27. ✅ [unit] should reject email payload with invalid to address — TPP: conditional — FLFI: `@IsEmail` fails on malformed address
28. ✅ [unit] should accept email payload with optional subject and body — TPP: conditional — FLFI: add `subject` and `body` as `@IsOptional` strings under `@ValidateIf(contentType === 'email')`
29. ✅ [unit] should accept valid vcard payload with name only — TPP: constant — FLFI: add `name` with `@IsNotEmpty` guarded by `contentType === 'vcard'`; extend `@IsIn`
30. ✅ [unit] should reject vcard payload missing name — TPP: conditional — FLFI: `@IsNotEmpty` fires when name absent for vcard type
31. ✅ [unit] should accept vcard with optional vcardEmail as a valid email when present — TPP: conditional — FLFI: add `vcardEmail` with `@IsOptional @IsEmail @ValidateIf(contentType === 'vcard')` — field named `vcardEmail` to avoid clash with `contentType = 'email'`
32. ✅ [unit] should not require content for wifi contentType — TPP: conditional — FLFI: add `@ValidateIf(o => o.contentType === 'url' || o.contentType === 'text')` to existing `content @IsNotEmpty`

### Group 6 — `GenerateQrUseCase` new branches (`backend/src/application/qr/generate-qr.use-case.spec.ts`)

33. ✅ [unit] should call encodeWifi and store ssid as content when contentType is wifi — TPP: conditional — FLFI: add wifi arm to `GenerateQrCommand` discriminated union; branch in `execute` calling `encodeWifi(cmd.wifi)` for QR string, storing `cmd.wifi.ssid` as `content`
34. ✅ [unit] should call encodeEmail and store to as content when contentType is email — TPP: conditional — FLFI: add email arm to union; branch calls `encodeEmail(cmd.emailFields)`, stores `cmd.emailFields.to` as content
35. ✅ [unit] should call encodeVcard and store name as content when contentType is vcard — TPP: conditional — FLFI: add vcard arm to union; branch calls `encodeVcard(cmd.vcard)`, stores `cmd.vcard.name` as content

### Group 7 — `QrController` unit tests (`backend/src/interfaces/http/controllers/qr.controller.spec.ts`)

36. ✅ [unit] should pass wifi fields through to GenerateQrUseCase command when contentType is wifi — TPP: conditional — FLFI: update `create` to spread `dto` structured fields (`ssid`, `security`, `password`, `to`, `subject`, `body`, `name`, `phone`, `vcardEmail`, `org`) into the command; update `GenerateQrCommand` discriminated union to map the DTO fields
37. ✅ [unit] should pass email fields through to GenerateQrUseCase command — TPP: variable — FLFI: same spread, different arm
38. ✅ [unit] should pass vcard fields through to GenerateQrUseCase command — TPP: variable — FLFI: same spread, different arm

### Group 8 — E2E (`backend/src/app.module.spec.ts`)

39. ✅ [e2e] POST /api/qr with valid wifi payload → 201 and body contains id and pngUrl — TPP: constant — FLFI: ValidationPipe accepts extended DTO; controller maps to use case; real SQLite stores row with contentType='wifi'
40. ✅ [e2e] POST /api/qr with wifi missing ssid → 400 — TPP: conditional — FLFI: ValidationPipe rejects DTO via `@IsNotEmpty` guard
41. ✅ [e2e] POST /api/qr with valid email payload → 201 — TPP: constant — FLFI: same wiring, email arm
42. ✅ [e2e] POST /api/qr with valid vcard payload → 201 — TPP: constant — FLFI: same wiring, vcard arm

### Group 9 — Frontend API client (`frontend/src/infrastructure/api/qr-auth.client.spec.ts`)

43. ✅ [unit] should POST wifi payload as JSON body when createQrCode called with wifi type — TPP: constant — FLFI: change `createQrCode` signature from `(contentType, content)` to `(payload: CreateQrPayload)` and `JSON.stringify(payload)`; add `CreateQrPayload` discriminated union type
44. ✅ [unit] should POST email payload with to, subject, body — TPP: variable — FLFI: same generic spread, no new code beyond 43
45. ✅ [unit] should POST vcard payload with name and optional fields — TPP: variable — FLFI: same

### Group 10 — `useDashboard` hook (`frontend/src/application/hooks/useDashboard.spec.ts`)

46. ✅ [unit] should accept CreateQrPayload and prepend result to items on create — TPP: conditional — FLFI: change `create` signature from `(contentType, content)` to `(payload: CreateQrPayload)` and pass through to `createQrCode(payload)`

### Group 11 — `CreateForm` UI (`frontend/src/presentation/pages/DashboardPage.spec.tsx`)

47. ✅ [unit] should render Wi-Fi, Email, vCard type buttons in the form — TPP: constant — FLFI: add three `<button>` elements to type selector row in `CreateForm`; update `contentType` state type to full union
48. ✅ [unit] should render ssid, security select, and password inputs when Wi-Fi is selected — TPP: conditional — FLFI: conditional render of wifi field set based on `contentType === 'wifi'`
49. ✅ [unit] should hide password input when security select is set to nopass — TPP: conditional — FLFI: add `security` state; conditionally render password when `security !== 'nopass'`
50. ✅ [unit] should render to, subject, body inputs when Email is selected — TPP: conditional — FLFI: conditional render of email field set
51. ✅ [unit] should render name, phone, email, org inputs when vCard is selected — TPP: conditional — FLFI: conditional render of vcard field set
52. ✅ [unit] should call onCreate with wifi CreateQrPayload on form submit — TPP: conditional — FLFI: build `CreateQrPayload` from form state based on `contentType` and call `onCreate(payload)`; update `CreateForm` prop type `onCreate: (payload: CreateQrPayload) => Promise<void>`
