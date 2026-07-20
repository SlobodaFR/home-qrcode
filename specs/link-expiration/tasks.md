# Tasks — link-expiration

## Tests

### Group A — Domain: `QrCode` entity (`domain/qr/qr-code.ts`)

✅ GREEN 1. [unit] should return null for expiresAt when not provided in props — TPP: constant — FLFI: add optional `expiresAt?: Date | null` to QrCodeProps; getter returns `this.props.expiresAt ?? null`
✅ GREEN 2. [unit] should return the provided Date for expiresAt when given in props — TPP: variable — FLFI: getter reads `props.expiresAt` directly; `?? null` only applies when field absent
✅ GREEN 3. [unit] withExpiration(date) should return a new QrCode instance with updated expiresAt — TPP: constant — FLFI: add `withExpiration(date: Date | null): QrCode` that spreads props and sets expiresAt to provided date
✅ GREEN 4. [unit] withExpiration(null) should return a new QrCode with expiresAt=null — TPP: variable — FLFI: same method handles null; no special branch; null sets the field

### Group B — Utility: `parseExpiryDate` helper

✅ GREEN 5. [unit] should convert 'YYYY-MM-DD' string to a Date at 23:59:59 UTC — TPP: constant — FLFI: `return new Date(\`${s}T23:59:59.000Z\`)`
✅ GREEN 6. [unit] should produce a Date whose UTC hours/minutes/seconds are 23/59/59 — TPP: variable — FLFI: same helper; no branch; test verifies UTC time components via getUTCHours(), getUTCMinutes(), getUTCSeconds()

### Group C — Application: `RedirectUseCase` change

✅ GREEN 7. [unit] should return targetUrl when expiresAt is null (unchanged behavior) — TPP: constant — FLFI: add null-guarded check `if (qr.expiresAt && ...)` so null skips the guard entirely
✅ GREEN 8. [unit] should throw GoneException when expiresAt is non-null and in the past — TPP: conditional — FLFI: add `if (qr.expiresAt) throw new GoneException()` (minimal form sufficient for this test)
✅ GREEN 9. [unit] should return targetUrl when expiresAt is non-null but in the future — TPP: conditional — FLFI: refine guard to `qr.expiresAt <= new Date()` to distinguish past from future; future → no throw
✅ GREEN 10. [unit] should NOT call incrementScanCount when GoneException is thrown — TPP: conditional — FLFI: guard placed before `incrementScanCount` in `execute()`; exception exits before the call

### Group D — Application: `SetExpirationUseCase` (new — `application/expiration/`)

✅ GREEN 11. [unit] should call repository.save with entity updated via withExpiration — TPP: constant — FLFI: `findByIdAndUserId` → `qr.withExpiration(cmd.expiresAt)` → `save(updated)`
✅ GREEN 12. [unit] should return entity with the new expiresAt value — TPP: variable — FLFI: return `{ entity: updated }` from `execute()`
✅ GREEN 13. [unit] should throw NotFoundException when record not found or not owned — TPP: conditional — FLFI: null guard on `findByIdAndUserId` result → `throw new NotFoundException()`
✅ GREEN 14. [unit] should call save with expiresAt=null when command expiresAt is null — TPP: variable — FLFI: `withExpiration(null)` passes null through; no null branch in use case needed

### Group E — Application: `GenerateQrUseCase` change

✅ GREEN 15. [unit] should create QrCode with expiresAt=null when not provided in command — TPP: constant — FLFI: add `expiresAt?: Date | null` to command type; pass `cmd.expiresAt ?? null` to `QrCode.create()`
✅ GREEN 16. [unit] should create QrCode with the provided expiresAt Date — TPP: variable — FLFI: `cmd.expiresAt ?? null` evaluates to provided Date when present

### Group F — Application: `CreateLinkUseCase` change

✅ GREEN 17. [unit] should create link with expiresAt=null when not provided in command — TPP: constant — FLFI: add `expiresAt?: Date | null` to `CreateLinkCommand`; pass `cmd.expiresAt ?? null` to `QrCode.create()`
✅ GREEN 18. [unit] should create link with the provided expiresAt Date — TPP: variable — FLFI: same `?? null` default; provided Date passes through unchanged

### Group G — Infrastructure: `TypeOrmQrRepository` (`typeorm-qr.repository.spec.ts`)

✅ GREEN 19. [integration] save() with non-null expiresAt should persist it and findById() should retrieve it as a Date — TPP: variable — FLFI: add `@Column({ type: 'datetime', name: 'expires_at', nullable: true }) expiresAt!: Date | null` to ORM entity; map in `save()` and `toDomain()`
✅ GREEN 20. [integration] save() with expiresAt=null should persist NULL and findById() should return null — TPP: conditional — FLFI: `row.expiresAt ?? null` in `toDomain()` maps DB NULL to domain null
✅ GREEN 21. [integration] existing row created before expires_at column exists should return expiresAt=null after synchronize — TPP: conditional — FLFI: INSERT raw row into SQLite before TypeORM sync; re-init with synchronize:true; assert row still readable with `expiresAt === null` (migration backward compat)

### Group H — DTO: `SetExpirationDto` (new)

✅ GREEN 22. [unit] should pass validation with a valid date-only string '2026-08-25' — TPP: constant — FLFI: `@ValidateIf(o => o.expiresAt !== null) @IsDateString() expiresAt!: string | null`
✅ GREEN 23. [unit] should fail validation with non-date string 'hello' — TPP: conditional — FLFI: `@IsDateString()` rejects non-ISO8601 string; returns errors array
✅ GREEN 24. [unit] should pass validation with null (clears expiry) — TPP: conditional — FLFI: `@ValidateIf(o => o.expiresAt !== null)` skips `@IsDateString()` when value is null → valid
✅ GREEN 25. [unit] should fail validation when expiresAt is absent from body (undefined) — TPP: conditional — FLFI: `undefined !== null` → ValidateIf passes → `@IsDateString()` runs on undefined → fails → 400

### Group I — DTO: `CreateQrDto` change

✅ GREEN 26. [unit] should accept valid optional expiresAt '2026-08-25' — TPP: variable — FLFI: add `@IsOptional() @IsDateString() expiresAt?: string` to `CreateQrDto`
✅ GREEN 27. [unit] should still pass when expiresAt is omitted entirely — TPP: conditional — FLFI: `@IsOptional()` skips `@IsDateString()` on absence; existing valid payloads unaffected

### Group J — DTO: `CreateOrEditLinkDto` change

✅ GREEN 28. [unit] should accept valid optional expiresAt '2026-08-25' — TPP: variable — FLFI: add `@IsOptional() @IsDateString() expiresAt?: string` to `CreateOrEditLinkDto`
✅ GREEN 29. [unit] should still pass when expiresAt is omitted — TPP: conditional — FLFI: `@IsOptional()` allows absence; existing link creation validations unaffected

### Group K — Interfaces: `QrController` changes

✅ GREEN 30. [unit] PATCH :id/expiration should call SetExpirationUseCase with Date from parseExpiryDate(dto.expiresAt) — TPP: constant — FLFI: new `@Patch(':id/expiration')` method; calls `parseExpiryDate(dto.expiresAt)` before passing to use case
✅ GREEN 31. [unit] PATCH :id/expiration with null should call SetExpirationUseCase with null (no parseExpiryDate call) — TPP: conditional — FLFI: `dto.expiresAt === null` guard bypasses `parseExpiryDate`; passes null to use case
✅ GREEN 32. [unit] GET / list response should include expiresAt on each item — TPP: variable — FLFI: add `expiresAt: qr.expiresAt?.toISOString() ?? null` to `toListItemResponse()`
✅ GREEN 33. [unit] POST / create response should include expiresAt field, and expiresAt from dto should be passed to use case as Date — TPP: variable — FLFI: add `expiresAt` to `toResponse()`; call `parseExpiryDate(dto.expiresAt)` when dto field present; pass `null` when absent

### Group L — Interfaces: `LinksController` changes

✅ GREEN 34. [unit] PATCH :id/expiration should call SetExpirationUseCase with Date from parseExpiryDate(dto.expiresAt) — TPP: constant — FLFI: new `@Patch(':id/expiration')` in LinksController; same parseExpiryDate pattern as QrController
✅ GREEN 35. [unit] PATCH :id/expiration with null should call SetExpirationUseCase with null — TPP: conditional — FLFI: null guard before parseExpiryDate; same pattern as QrController
✅ GREEN 36. [unit] GET / list response should include expiresAt on each item — TPP: variable — FLFI: add `expiresAt: link.expiresAt?.toISOString() ?? null` to `toResponse()` in LinksController

### Group M — E2E: `AppModule`

✅ GREEN 37. [e2e] PATCH /api/qr/:id/expiration without auth should return 401 — TPP: constant — FLFI: no `@Public()` on endpoint; JwtAuthGuard rejects unauthenticated request
✅ GREEN 38. [e2e] PATCH /api/links/:id/expiration without auth should return 401 — TPP: constant — FLFI: same guard; no special handling needed
✅ GREEN 39. [e2e] GET /r/:id should return 410 when record has expiresAt in the past — TPP: conditional — FLFI: seed record with past expiresAt via TypeORM directly; GET /r/:id → assert status 410
✅ GREEN 40. [e2e] GET /r/:id should return 302 when record has expiresAt in the future — TPP: variable — FLFI: seed with future expiresAt; GET /r/:id → assert 302 + Location header present and unchanged

### Group N — Frontend: `qr-auth.client.ts` changes

✅ GREEN 41. [unit] setQrExpiration(id, expiresAt) should PATCH /api/qr/:id/expiration with {expiresAt} body and credentials — TPP: constant — FLFI: add `async function setQrExpiration(id, expiresAt): Promise<QrItem>` that fetches PATCH with `credentials:'include'` and JSON body `{expiresAt}`
✅ GREEN 42. [unit] setQrExpiration(id, null) should send {expiresAt: null} in body — TPP: variable — FLFI: null passes through to `JSON.stringify({expiresAt: null})`; same fetch call
✅ GREEN 43. [unit] QrItem returned from listQrCodes should include expiresAt field from API response — TPP: variable — FLFI: add `expiresAt: string | null` to `QrItem` interface; `listQrCodes()` returns items with the field mapped from JSON

### Group O — Frontend: `links.client.ts` changes

✅ GREEN 44. [unit] setLinkExpiration(id, expiresAt) should PATCH /api/links/:id/expiration with {expiresAt} body and credentials — TPP: constant — FLFI: add `async function setLinkExpiration(id, expiresAt): Promise<ShortLinkItem>` that fetches PATCH with `credentials:'include'`
✅ GREEN 45. [unit] createLink() should include expiresAt in POST body when provided — TPP: variable — FLFI: add optional `expiresAt?: string` param to `createLink()`; spread into JSON body when defined
✅ GREEN 46. [unit] ShortLinkItem returned from listLinks should include expiresAt field — TPP: variable — FLFI: add `expiresAt: string | null` to `ShortLinkItem` interface; `listLinks()` maps the field from JSON

### Group P — Frontend: `useDashboard` hook

✅ GREEN 47. [unit] setExpiration(id, dateString) should call setQrExpiration and replace matching item in state — TPP: variable — FLFI: add `setExpiration: (id, expiresAt) => Promise<void>` that calls `setQrExpiration`, then maps items replacing matched id with returned updated item
✅ GREEN 48. [unit] setExpiration(id, null) should call setQrExpiration with null and update state with null expiresAt — TPP: conditional — FLFI: null passes through to `setQrExpiration`; same map-replace logic handles null expiresAt on returned item

### Group Q — Frontend: `useLinks` hook

✅ GREEN 49. [unit] setExpiration(id, dateString) should call setLinkExpiration and replace matching item in state — TPP: variable — FLFI: add `setExpiration: (id, expiresAt) => Promise<void>` that calls `setLinkExpiration`, maps items replacing matched id
✅ GREEN 50. [unit] setExpiration(id, null) should call setLinkExpiration with null and update state — TPP: conditional — FLFI: null passes through; same map-replace logic

### Group R — Frontend: `DashboardPage` — QrCard expiry UI

✅ GREEN 51. [unit] QrCard should show "Expire le [date]" text when expiresAt is in the future — TPP: constant — FLFI: add conditional in QrCard: when `expiresAt && new Date(expiresAt) > Date.now()`, render localized date string
✅ GREEN 52. [unit] QrCard should show "Expiré" badge when expiresAt is in the past — TPP: conditional — FLFI: when `expiresAt && new Date(expiresAt) <= Date.now()`, render badge with text "Expiré"
✅ GREEN 53. [unit] QrCard should show no expiry indicator when expiresAt is null — TPP: conditional — FLFI: null expiresAt → neither "Expire le" text nor "Expiré" badge rendered
✅ GREEN 54. [unit] QrCard should render date input with data-testid="expiry-date-input" — TPP: constant — FLFI: add `<input type="date" data-testid="expiry-date-input" />` to QrCard unconditionally
✅ GREEN 55. [unit] QrCard expiry date input onChange should call setExpiration(id, value) — TPP: variable — FLFI: `onChange={e => setExpiration(qr.id, e.target.value)}` wired to `useDashboard.setExpiration`
✅ GREEN 56. [unit] QrCard should show "Supprimer l'expiration" button when expiresAt is non-null — TPP: conditional — FLFI: conditionally render button when `qr.expiresAt !== null`
✅ GREEN 57. [unit] QrCard "Supprimer l'expiration" button onClick should call setExpiration(id, null) — TPP: variable — FLFI: `onClick={() => setExpiration(qr.id, null)}`

### Group S — Frontend: `DashboardPage` — LinksSection/LinkCard expiry UI

✅ GREEN 58. [unit] LinkCard should show "Expire le [date]" text when expiresAt is in the future — TPP: constant — FLFI: same pattern as QrCard; conditional render of formatted date in LinkCard
✅ GREEN 59. [unit] LinkCard should show "Expiré" badge when expiresAt is in the past — TPP: conditional — FLFI: same date comparison; badge rendered when expired
✅ GREEN 60. [unit] LinkCard date input onChange should call setExpiration(id, value) from useLinks — TPP: variable — FLFI: `onChange={e => setExpiration(link.id, e.target.value)}` wired to `useLinks.setExpiration`
✅ GREEN 61. [unit] LinkCard "Supprimer l'expiration" button onClick should call setExpiration(id, null) — TPP: conditional — FLFI: conditionally rendered when `link.expiresAt !== null`; onClick → `setExpiration(link.id, null)`
✅ GREEN 62. [unit] LinksSection CreateForm date input should include expiresAt in create() call when value entered — TPP: variable — FLFI: add date input state to LinksSection CreateForm; on submit pass `expiresAt` to `create(url, expiresAt)` in useLinks

### Group T — Frontend: `DashboardPage` — QR CreateForm expiry UI

✅ GREEN 63. [unit] QR CreateForm date input should pass expiresAt to onCreate when entered — TPP: variable — FLFI: add optional `<input type="date" />` to QR CreateForm; on submit include `expiresAt` in `onCreate({ ..., expiresAt })` payload
