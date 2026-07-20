# Spec — logo-overlay

## Summary

Optional logo/image overlay at the center of a generated QR code, attached via a dedicated `POST /api/qr/:id/logo` endpoint after creation. When a logo is present, error correction is enforced at ≥ Q (25% capacity) and the QR PNG is regenerated. The logo is stored in MinIO and proxied via `GET /api/qr/:id/logo`. SVG is not composited. Logo is immutable after first attach (delete and recreate to change it).

A new `encodedContent` column stores the exact string encoded into the QR image, enabling PNG regeneration at a higher correction level for all content types including wifi, email, and vCard.

## User Stories

**US1 — Attach logo after creation**
Given I have created a QR code,
When I upload a logo image via `POST /api/qr/:id/logo`,
Then the QR code PNG is regenerated with the logo composited at center,
And the stored `errorCorrection` reflects the level actually used (≥ Q).

**US2 — Correction level auto-upgrade**
Given I have created a QR code at correction level L or M,
When I attach a logo,
Then the regenerated PNG uses correction level Q,
And `errorCorrection` in DB is updated to `Q`.

**US3 — No logo — behavior unchanged**
Given I create a QR code without attaching a logo,
Then the generation flow is identical to the current behavior,
And `hasLogo` is `false` and `encodedContent` is stored.

**US4 — Logo proxy route**
Given a QR code with a logo exists,
When I request `GET /api/qr/:id/logo`,
Then I receive the logo image bytes,
And no MinIO URL is ever returned in any API response.

**US5 — No logo proxy → 404**
Given a QR code has `hasLogo: false`,
When I request `GET /api/qr/:id/logo`,
Then the response is 404.

**US6 — Re-attachment rejected**
Given a QR code already has `hasLogo: true`,
When I call `POST /api/qr/:id/logo` again,
Then the response is 409 Conflict.

**US7 — Frontend logo upload input**
Given I am on the dashboard filling the creation form,
When I select a logo file and the active correction level is L or M,
Then a notice appears: "Le niveau de correction sera élevé à Q pour permettre l'intégration du logo.",
And after creation, a "Ajouter un logo" button is shown on the QR card.

## Acceptance Criteria

### AC1 — `encodedContent` stored at generation time
- Given any `GenerateQrUseCase` execution,
  the `encodedContent` field on `QrCode` stores the exact string passed to `QrImageGenerator` (e.g. `WIFI:T:WPA;S:HomeNet;P:secret;;` for wifi, `{frontendUrl}/r/{id}` for URL, etc.).
- `QrCodeProps` and `QrCode` entity include `encodedContent: string`.
- ORM entity includes `encodedContent` column (`text`, non-nullable for new records).
- No DDL migration file needed (`synchronize: true`).

### AC2 — `hasLogo` field on entity
- Given any `GenerateQrUseCase` execution without logo attachment,
  `hasLogo` is stored as `false`.
- `QrCodeProps` and `QrCode` entity include `hasLogo: boolean` (default `false`).
- ORM entity includes `hasLogo` column (`boolean`, default `false`).

### AC3 — `POST /api/qr/:id/logo` endpoint
- Given I am authenticated and own the QR with `:id`,
  When I POST a valid image file (≤ 2 MB, MIME: image/png, image/jpeg, or image/webp),
  Then the response is 200 with the updated `QrItem` (including `hasLogo: true`, updated `errorCorrection`).
- Given the QR does not exist or belongs to another user,
  Then the response is 404.
- Given `hasLogo` is already `true`,
  Then the response is 409.
- Given the file exceeds 2 MB,
  Then the response is 400.
- Given the file MIME type is not png/jpeg/webp,
  Then the response is 400.

### AC4 — Correction level enforcement on attach
- Given `AttachLogoUseCase` is called,
  the effective correction level used for regeneration is `errorCorrection = stored errorCorrection >= Q ? stored : Q`.
- Given stored level was `L` or `M`, the regenerated PNG uses `Q` and `errorCorrection` in DB is updated to `Q`.
- Given stored level was `Q` or `H`, the regenerated PNG uses the stored level unchanged.

### AC5 — Logo compositing on PNG
- Given a QR PNG and a logo buffer,
  the logo is composited centered on the PNG (both axes),
  scaled to 30% of QR width (maintaining aspect ratio),
  with alpha channel preserved (no flattening).
- The resulting PNG is a valid PNG buffer.

### AC6 — Logo storage in MinIO
- Logo uploaded to MinIO under key `{assetsPath}/{id}/logo.{ext}`,
  where ext is: `png` for image/png, `jpg` for image/jpeg, `webp` for image/webp.
- `GET /api/qr/:id/logo` is `@Public()` and returns the logo bytes with correct `Content-Type`.
- No raw MinIO URL is returned in any API response.

### AC7 — PNG overwrite in MinIO
- Given logo compositing succeeds,
  the new PNG (at updated correction level, with logo) overwrites `{assetsPath}/{id}/qr.png` in MinIO.
- SVG is NOT regenerated or modified.

### AC8 — DB update on successful attach
- Given all MinIO operations succeed,
  the `QrCode` record is updated: `hasLogo = true`, `errorCorrection = max(stored, Q)`.
- Given any MinIO operation fails,
  the DB is NOT updated (503 returned; no partial state).

### AC9 — Delete cleans up logo
- Given `DeleteQrUseCase` is called on a QR with `hasLogo: true`,
  `QrStoragePort.delete(id)` also attempts to remove `{assetsPath}/{id}/logo.*` from MinIO.
- Deletion is best-effort (consistent with existing PNG/SVG deletion pattern — errors logged as WARN, not thrown).

### AC10 — `QrItem` response includes `hasLogo`
- All `toResponse` / `toListItemResponse` mappings include `hasLogo: boolean`.
- When `hasLogo: true`, frontend constructs logo URL as `/api/qr/:id/logo`.

### AC11 — Dashboard logo upload flow
- Dashboard QR card shows "Ajouter un logo" button when `hasLogo: false`.
- Clicking opens a file picker (accept: image/png, image/jpeg, image/webp).
- If selected file > 2 MB, show inline error and disable submit.
- On successful attach, card updates to show logo thumbnail (via `/api/qr/:id/logo`).
- Dashboard creation form: when a logo file is selected and correction level is L or M,
  show notice: "Le niveau de correction sera élevé à Q pour permettre l'intégration du logo."

### AC12 — `sharp` added as production dependency
- `sharp` added to `backend/package.json` dependencies.
- `@types/sharp` added to devDependencies.
- No Dockerfile changes required (`node:26-bookworm-slim` + existing build tools are compatible with `sharp` prebuilts).

## Out of Scope

- Logo composited into SVG (SVG remains clean vector output).
- Logo removal or replacement after first attach.
- Configurable logo size ratio (fixed at 30% of QR width).
- Accepted formats beyond PNG, JPEG, WebP (GIF, TIFF, BMP → 400).
- Logo shown inline on the public `/q/{id}` page (page links to `/api/qr/:id/logo` but no special display).
- Logo upload as part of `POST /api/qr` creation (always a separate post-creation step).

## Edge Cases

### EC1 — Backward compat: existing QRs with null `encodedContent`
- Given a QR created before this feature (null `encodedContent`),
  When `POST /api/qr/:id/logo` is called:
  - `contentType === 'url'` → reconstruct `encodedContent` as `{frontendUrl}/r/{id}` (always stable).
  - `contentType === 'text'` → use stored `content` as `encodedContent`.
  - `contentType === 'wifi' | 'email' | 'vcard'` → return 422 with message "Ce QR code a été créé avant le support des logos. Recréez-le pour ajouter un logo."

### EC2 — Logo already present (re-attachment)
- Given `hasLogo: true`,
  When `POST /api/qr/:id/logo` is called,
  Then response is 409 Conflict. No file is read, no MinIO op is performed.

### EC3 — QR not owned by caller
- Given QR does not exist or `userId` does not match,
  When `POST /api/qr/:id/logo` is called,
  Then response is 404. (Same pattern as `findByIdAndUserId` used throughout.)

### EC4 — Logo file has alpha (PNG with transparency)
- Alpha channel preserved during compositing. No white/black background flatten applied.

### EC5 — Logo source dimensions smaller than 10×10 px
- Scale up to 30% of QR width (no minimum floor — tiny logos are the user's problem).

### EC6 — QR size < 100px
- 30% ratio still applied. Logo may be very small but no special rejection.

### EC7 — `errorCorrection` = H with logo
- H > Q → no upgrade. Regenerated at H. `errorCorrection` in DB unchanged.

### EC8 — MinIO upload fails mid-attach
- If logo upload fails → return 503, no DB change.
- If PNG overwrite fails after logo upload → return 503, no DB change. Logo orphaned in MinIO (acceptable — best-effort cleanup not required for a failed attach).

### EC9 — Animated GIF (or other invalid MIME)
- FileInterceptor MIME check → reject 400 before any processing.

### EC10 — `editTargetUrl` with logo
- Changing redirect target only updates the DB `content` field. PNG (with logo) unchanged. Correct: URL QRs encode `/r/{id}` which is stable.

## Grill Log

| # | Question | Resolution | Decided by |
|---|---|---|---|
| OQ1 | Upload mechanism: inline multipart vs separate endpoint | **Option A**: `POST /api/qr/:id/logo` post-creation. Keeps `POST /api/qr` as pure JSON. | User |
| OQ2 | `sharp` as new dependency | Accept. `node:26-bookworm-slim` + existing build tools (python3/make/g++) are compatible with `sharp` prebuilts. No Dockerfile changes. | Codebase read |
| OQ3 | Logo MinIO key naming | `{assetsPath}/{id}/logo.{ext}` — consistent with existing `{assetsPath}/{id}/qr.{ext}` pattern. | Codebase read |
| OQ4 | Logo proxy route auth | `@Public()` — consistent with PNG/SVG proxy routes; required for public `/q/{id}` page. | Codebase read |
| OQ5 | Store requested or actual `errorCorrection` | Store actual (Q), not requested (L). DB reflects reality. | User |
| Implied | `encodedContent` column needed for regeneration | **Option X**: add `encodedContent: string` to entity. `GenerateQrUseCase` stores exact encoded string. `AttachLogoUseCase` reads it to regenerate. | User |
| Implied | Re-attachment when `hasLogo: true` | **R2**: reject 409. Logo immutable after first attach. | User |
| Implied | Backward compat for null `encodedContent` | url/text: reconstruct from known formula. wifi/email/vcard: 422 with "recreate QR" message. | Spec |
| Implied | Logo proxy 404 when `hasLogo: false` | 404. Consistent with PNG/SVG 404 on missing file. | Spec |
| Implied | Atomicity of attach operation | Best-effort. If any MinIO op fails → 503, no DB update. Logo may orphan in MinIO on partial failure — acceptable. | Spec |
