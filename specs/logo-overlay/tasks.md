# Tasks — logo-overlay

Tests ordered by dependency (leaf components first). Each group references the file it extends or creates.

## Tests

### Group A — `QrCode` domain entity
**File**: `backend/src/domain/qr/qr-code.spec.ts` (add to existing)

1. [unit] should store `encodedContent` and expose it via getter — TPP: variable — FLFI: add `encodedContent` to `QrCodeProps` and a getter that returns it
2. [unit] should store `hasLogo: false` and expose `logoUrl` as `/api/qr/{id}/logo` — TPP: variable — FLFI: add `hasLogo` prop and `logoUrl` getter returning the fixed proxy path
3. [unit] `withLogo()` should return new instance with `hasLogo: true`, updated `errorCorrection`, and `logoMimeType` set — TPP: variable — FLFI: implement `withLogo(correction, mimeType)` spreading props + overriding three fields
4. [unit] `withLogo()` should not mutate the original instance — TPP: conditional — FLFI: `withLogo()` constructs a new `QrCode` rather than mutating `this.props`

### Group B — `SharpLogoCompositor`
**File**: `backend/src/infrastructure/qr/sharp-logo-compositor.spec.ts` (new)

5. [unit] `composite()` should return a non-empty Buffer — TPP: constant — FLFI: call `sharp` composite and return the output buffer
6. [unit] `composite()` output should have the same pixel dimensions as the input QR PNG — TPP: variable — FLFI: use `sharp.composite()` with `fit: 'inside'` resize on logo so QR dimensions are preserved

### Group C — `GenerateQrUseCase` updates
**File**: `backend/src/application/qr/generate-qr.use-case.spec.ts` (add to existing)

7. [unit] URL type: saved `qr.encodedContent` should equal `{frontendUrl}/r/{id}` — TPP: variable — FLFI: pass `encodedContent` (the string given to generator) into `QrCode.create()` props
8. [unit] Wifi type: saved `qr.encodedContent` should equal the encoded wifi string — TPP: variable — FLFI: same as above; encodedContent is already computed before calling generator
9. [unit] Any type: saved `qr.hasLogo` should be `false` — TPP: constant — FLFI: hard-code `hasLogo: false` in `QrCode.create()` call inside use case

### Group D — `AttachLogoUseCase`
**File**: `backend/src/application/qr/attach-logo.use-case.spec.ts` (new)

10. [unit] should throw `NotFoundException` when QR not found — TPP: constant — FLFI: call `findByIdAndUserId`, throw if null
11. [unit] should throw `ConflictException` when `qr.hasLogo` is `true` — TPP: conditional — FLFI: check `qr.hasLogo` after fetch, throw 409
12. [unit] URL type with `encodedContent: null` should reconstruct as `{frontendUrl}/r/{id}` — TPP: conditional — FLFI: branch on null `encodedContent` + `contentType === 'url'` to build the redirect URL
13. [unit] Text type with `encodedContent: null` should use `qr.content` directly — TPP: conditional — FLFI: add else-if branch for `contentType === 'text'`
14. [unit] Wifi type with `encodedContent: null` should throw `UnprocessableEntityException` — TPP: conditional — FLFI: add else branch throwing 422 for wifi/email/vcard with null encodedContent
15. [unit] Should use stored `encodedContent` (non-null) directly without reconstruction — TPP: conditional — FLFI: add early-return branch when `qr.encodedContent` is set
16. [unit] L correction level should be upgraded to Q when calling `generator.generate()` — TPP: conditional — FLFI: compute `effectiveCorrection = ['L','M'].includes(ec) ? 'Q' : ec` and pass to generator
17. [unit] H correction level should be passed to `generator.generate()` unchanged — TPP: conditional — FLFI: the else branch of the conditional in test 16 returns the original value
18. [unit] Should call `compositor.composite()` with the PNG from generator and the provided `logoBuffer` — TPP: variable — FLFI: pass `generator.generate()` result's `png` and `cmd.logoBuffer` to `compositor.composite()`
19. [unit] On success: should upload logo, overwrite PNG, save QR with `hasLogo: true` and updated fields, and return updated QR — TPP: variable — FLFI: call `storage.uploadLogo`, `storage.uploadPng`, `qr.withLogo()`, `repository.save()` in sequence; return `{ qr: updatedQr }`

### Group E — `MinioQrStorage` additions
**File**: `backend/src/infrastructure/qr/minio-qr-storage.spec.ts` (add to existing)

20. [unit] `uploadLogo()` should call `minio.putObject` with key `{assetsPath}/{id}/logo` and the provided content-type — TPP: constant — FLFI: implement `uploadLogo()` calling `putObject` with the extension-less logo key
21. [unit] `streamLogo()` should call `minio.getObject` with key `{assetsPath}/{id}/logo` — TPP: constant — FLFI: implement `streamLogo()` calling `getObject` with the same key
22. [unit] `delete()` should include the logo key alongside png and svg in `Promise.allSettled` — TPP: variable — FLFI: add a third `removeObject` call for `{assetsPath}/{id}/logo` to the existing `allSettled` array

### Group F — TypeORM repository mapper
**File**: `backend/src/infrastructure/persistence/repositories/typeorm-qr.repository.spec.ts` (add to existing)

23. [unit] `toDomain()` should map `encodedContent`, `hasLogo`, and `logoMimeType` from the ORM row — TPP: variable — FLFI: add the three new fields to the `QrCode.create()` call inside `toDomain()`
24. [unit] `save()` should persist `encodedContent`, `hasLogo`, and `logoMimeType` to the ORM entity — TPP: variable — FLFI: add the three fields to the `repository.save()` call inside the TypeORM repo's `save()`

### Group G — Controller HTTP boundary (E2E)
**File**: `backend/src/app.module.spec.ts` (add to existing)

25. [e2e] `POST /api/qr/:id/logo` without auth should return 401 — TPP: constant — FLFI: route exists and is protected by `JwtAuthGuard`
26. [e2e] `GET /api/qr/:id/logo` with unknown id should return 404 — TPP: constant — FLFI: route is `@Public()`; controller calls `findById`, throws `NotFoundException` if null or `hasLogo: false`

### Group H — Frontend: API client
**File**: `frontend/src/infrastructure/api/qr-auth.client.spec.ts` (add to existing)

27. [unit] `attachLogo()` should send a `FormData` with a `logo` field to `POST /api/qr/{id}/logo` and return the updated `QrItem` — TPP: constant — FLFI: implement `attachLogo(id, file)` using `FormData` + `fetch` with `credentials: 'include'`

### Group I — Frontend: `useDashboard` hook
**File**: `frontend/src/application/hooks/useDashboard.spec.ts` (add to existing)

28. [unit] `attachLogo()` should call the API client and replace the matching item in the items list — TPP: variable — FLFI: add `attachLogo(id, file)` that calls `attachLogoQrCode()` and updates `items` state with the returned QR

### Group J — Frontend: `DashboardPage` UI
**File**: `frontend/src/presentation/pages/DashboardPage.spec.tsx` (add to existing)

29. [unit] `QrCard` should show "Ajouter un logo" button when `hasLogo` is `false` — TPP: constant — FLFI: render button with that label when `qr.hasLogo === false`
30. [unit] `QrCard` should not show "Ajouter un logo" button when `hasLogo` is `true` — TPP: conditional — FLFI: conditionally hide the button when `qr.hasLogo === true`
31. [unit] `QrCard` SVG link should show "SVG (sans logo)" when `hasLogo` is `true`, "SVG" otherwise — TPP: conditional — FLFI: replace static "SVG" label with conditional text
32. [unit] Logo attachment panel should show correction-level notice when QR `errorCorrection` is L or M — TPP: conditional — FLFI: render notice element when `qr.errorCorrection === 'L' || 'M'`
33. [unit] Logo attachment panel should not show correction-level notice when `errorCorrection` is Q or H — TPP: conditional — FLFI: absence of notice in else branch
