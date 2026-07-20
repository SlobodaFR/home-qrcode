# Review — link-expiration

## Spec Coverage

| Criterion | Test(s) | Status |
|---|---|---|
| **AC1** — `qr_codes` gains nullable `expires_at` column | T19 (integration: save + findById round-trip) | ✅ |
| **AC1** — Existing rows default to NULL (backward compat) | T21 (integration: pre-migration row survives with expiresAt=null) | ✅ |
| **AC2** — `expiresAt` past → 410, scan counter NOT incremented | T8, T10 (unit); T39 (e2e) | ✅ |
| **AC2** — `expiresAt` null → 302, scan counter increments | T7 (unit); T40 (e2e future variant) | ✅ |
| **AC2** — `expiresAt` future → 302, scan counter increments | T9 (unit) | ✅ |
| **AC2** — Performance: single DB lookup, in-memory check | T7–T10 (unit): no extra repo call; T39–T40 (e2e) | ✅ |
| **AC3** — POST /api/qr with expiresAt → stored as T23:59:59.000Z | T5, T6 (parseExpiryDate unit); T33 (controller) | ✅ |
| **AC3** — POST /api/links with expiresAt → same | T34 (controller) | ✅ |
| **AC3** — expiresAt omitted → NULL | T15, T17 (application); T27, T29 (DTO) | ✅ |
| **AC3** — Non-date string → 400 | T23 (DTO unit) | ✅ |
| **AC3** — Past date accepted (not 400), /r/{id} → 410 | T8 + T39 (past date → 410) | ✅ |
| **AC3** — Response includes expiresAt | T32–T33 (QrController), T36 (LinksController) | ✅ |
| **AC4** — PATCH /api/qr/:id/expiration (auth, owner only) | T30, T31 (controller unit); T37 (e2e 401) | ✅ |
| **AC4** — PATCH /api/links/:id/expiration (auth, owner only) | T34, T35 (controller unit); T38 (e2e 401) | ✅ |
| **AC4** — Shared SetExpirationUseCase | T11–T14 (use case unit) | ✅ |
| **AC4** — findByIdAndUserId → 404 if not owner | T13 (unit) | ✅ |
| **AC4** — null clears expiration | T14 (use case); T31, T35 (controllers); T50 (useLinks) | ✅ |
| **AC4** — Response 200 with updated item | T30, T31, T34, T35 (controller unit) | ✅ |
| **AC5** — GET /api/qr list includes expiresAt per item | T32 (controller unit) | ✅ |
| **AC5** — GET /api/links list includes expiresAt per item | T36 (controller unit) | ✅ |
| **AC6** — QrCard future expiresAt → "Expire le [date]" | T51 | ✅ |
| **AC6** — QrCard past expiresAt → "Expiré" badge | T52 | ✅ |
| **AC6** — QrCard null → no indicator | T53 | ✅ |
| **AC6** — QrCard date input to set/update expiry | T54, T55 | ✅ |
| **AC6** — QrCard "Supprimer l'expiration" clears expiry | T56, T57 | ✅ |
| **AC6** — QR creation form date input | T63 | ✅ |
| **AC6** — LinkCard same pattern (future/past/null/input/clear) | T58–T61 | ✅ |
| **AC6** — Short link creation form date input | T62 | ✅ |
| **EC2** — Past date at creation → accepted, not 400 | T8 (unit redirect), T39 (e2e) | ✅ |
| **EC3** — Edit target URL on expired record succeeds | No explicit test | ⚠️ minor gap (see Architecture Drift) |
| **EC6** — Non-URL contentType + expiresAt set: no guard | T13 implicitly (no contentType check in use case) | ✅ |
| **EC7** — Timezone: always stored as T23:59:59.000Z UTC | T5, T6 (parseExpiryDate) | ✅ |

## Architecture Drift

**No drift** from `plan.md`. All files match the plan's blueprint:

- `application/expiration/set-expiration.use-case.ts` — new slice, cross-cutting, as planned.
- `parseExpiryDate` in `interfaces/http/utils/` — plan said "controller file or shared utils"; utils is the better choice and avoids repetition. No functional drift.
- `@Inject('SetExpirationUseCase')` string token in both `QrModule` and `LinksModule` — matches plan's dual-registration approach.
- `QrCode.withExpiration()` copy-on-write — matches domain contract exactly.

**EC3 (edit expired record)** — no test was written for this edge case. The current implementation correctly has no expiry guard in `EditTargetUrlUseCase` or `EditLinkUseCase`, so the behavior is correct by default. No new code could accidentally break this. Advisory only; not a blocker.

## Constitution Violations

Checked against `CLAUDE.md` non-negotiables:

| Rule | Finding |
|---|---|
| Domain layer: zero infrastructure imports | `domain/qr/qr-code.ts` imports nothing. `expiresAt?: Date | null` uses native `Date`. ✅ |
| URL QR codes encode `{APP_URL}/r/{id}` | Not touched by this feature. ✅ |
| No direct MinIO URLs in responses | Not touched. ✅ |
| `/r/{id}` unauthenticated, < 100ms | Expiry check is single `findById` + in-memory comparison. No extra query. ✅ |
| Auth cookies httpOnly | Not touched. ✅ |
| `FRONTEND_URL` drives all public links | `LinksController.toResponse` uses `this.config.getOrThrow('FRONTEND_URL')`. ✅ |
| SQLite only | Only a new nullable column added. ✅ |
| Deleted QR codes → 404 | Delete flow unchanged. ✅ |

**Pre-existing pattern (not a new violation):** `@Injectable()` from `@nestjs/common` appears in `SetExpirationUseCase` and `GoneException` in `RedirectUseCase`. This is identical to every other use case in the codebase — established pattern, not introduced here.

## TDD Discipline Smells

- **Test 53 (QrCard null → no indicator) passed trivially.** The test checks `queryByText` returns null, which is true before any implementation. Documented as a correct V4-adjacent case: "nothing rendered for null" is the desired behavior; the test documents intent even if it didn't force implementation. No defensive code was written without a failing test.
- No over-broad implementations found: `parseExpiryDate` does one thing, `withExpiration` does one thing, `SetExpirationUseCase` does exactly what its four tests demand.
- `PATCH ':id/expiration'` declared before `PATCH ':id'` in both controllers — correct NestJS route ordering; no route shadowing risk.

## Verdict

**ready for /qa**

One advisory (non-blocking):
- EC3 (edit URL on expired record) has no explicit test. The behavior is correct (no expiry guard in edit use cases), and the risk of accidental regression is negligible since those use cases were not modified. Add a test in a future cleanup cycle if desired.
