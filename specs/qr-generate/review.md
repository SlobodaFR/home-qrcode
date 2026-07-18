# Review — qr-generate

Reviewed against `spec.md` (20 ACs), `plan.md`, and `CLAUDE.md`. 85/85 tests green (was 43 before this feature; 42 new tests added).

---

## Spec Coverage

| AC | Criterion | Test(s) | Status |
|---|---|---|---|
| 1 | `POST /api/qr` → 201 with full response shape | Test 33, 34 | ✅ |
| 2 | URL type: QR encodes `{FRONTEND_URL}/r/{id}`, not target URL | Test 4 | ✅ |
| 3 | Text type: QR encodes `content` directly | Test 3 | ✅ |
| 4 | PNG at `size×size` pixels; SVG scalable; `qrcode` npm ISO 18004 | Test 10, 11 | ✅ |
| 5 | Both uploads sync before 201; if either fails → 500, no DB write | Test 8, 9 | ✅ |
| 6 | MinIO keys: `qr/{id}/qr.png` and `qr/{id}/qr.svg` | Test 12, 13 | ✅ |
| 7 | `qr_codes` table: UUID PK, userId, contentType, content, size, fgColor, bgColor, errorCorrection, createdAt | Test 19, ORM entity | ✅ |
| 8 | `GET /api/qr/:id/png` — `@Public()`, PNG stream, correct headers | Test 37, 41 | ✅ |
| 9 | `GET /api/qr/:id/svg` — `@Public()`, SVG stream, correct headers | Test 38 | ✅ |
| 10 | Unknown `id` on proxy routes → 404 | Test 39, 41 | ✅ |
| 11 | `GET /api/qr/:id` (owner) → metadata response | Test 35 | ✅ |
| 12 | `GET /api/qr/:id` for non-owner → 404 | Test 36 | ✅ |
| 13 | `POST /api/qr` without auth → 401 | Test 40 | ✅ |
| 14 | fgColor/bgColor: hex `#RRGGBB`; defaults `#000000`/`#FFFFFF` | Test 29, 32 | ✅ |
| 15 | errorCorrection: L\|M\|Q\|H; default M | Test 32 | ✅ |
| 16 | size: int 128–4096; default 1024 | Test 30, 31, 32 | ✅ |
| 17 | content non-empty; contentType url\|text | Test 27 | ✅ |
| 18 | url contentType + non-http(s) content → 400 | Test 28 | ✅ |
| 19 | MinIO health check at startup (prod-only) | Test 22, 23, 24 | ✅ |
| 20 | `FRONTEND_URL` drives encoded URL, no `APP_URL` var | Test 4, 34 | ✅ |

All 20 ACs covered.

---

## Architecture Drift

| Area | Plan says | Implementation | Delta |
|---|---|---|---|
| Domain ports | 4 abstract classes in `domain/qr/` | All 4 present | None |
| Use case | `GenerateQrUseCase` in `application/qr/` | Present, `frontendUrl` in command | None |
| Infrastructure | `QrcodeImageGenerator`, `MinioQrStorage`, `MinioClientService` | All present | None |
| QrModule | Feature slice mirror of AuthModule | Present | None |
| MinioModule | `@Global()` with `OnModuleInit` health check | Present, prod-only guard | None |
| `docker-compose.dev.yml` | Added to scope in plan | Created at project root | None |
| Controller: proxy routes | DB check first, then `exists()`, then stream | Implemented — avoids MinIO call for nonexistent QRs | Refinement vs plan (plan said `exists()` only); better: DB check + `exists()` in sequence |
| Index `(user_id, created_at DESC)` | Proactive on `qr_codes` | Present on `QrCodeOrmEntity` | None |

**Note on controller refinement**: proxy routes now call `qrRepository.findById(id)` first before `storage.exists()`. This was not in the plan but is correct: avoids a MinIO connection for a nonexistent QR, aligns with E6 (DB present + MinIO missing → 404) and E7 (MinIO down, but QR not in DB → 404 not 503).

---

## Constitution Violations

| Rule | Status |
|---|---|
| Domain layer zero infra deps | ✅ — `domain/qr/` imports only stdlib types (`NodeJS.ReadableStream` via `@types/node`) |
| No direct MinIO URLs in API responses | ✅ — responses return `/api/qr/{id}/png`, `/api/qr/{id}/svg` only |
| URL QR always encodes `{FRONTEND_URL}/r/{id}` | ✅ — enforced in use case |
| `FRONTEND_URL` drives all public links | ✅ — controller reads `FRONTEND_URL`, passes as `frontendUrl` to command |
| httpOnly cookies — N/A | — |
| SQLite only | ✅ |
| TypeScript strict, no `any` | ✅ — lint clean |
| No comments explaining what | ✅ |

No violations.

---

## TDD Discipline

- No over-broad implementations detected
- All branches tested (url/text split, upload failure paths, exists() true/false, health check prod/dev, owner vs non-owner)
- `exists()` in `MinioQrStorage` catches only `NotFound`/`NoSuchKey` error codes; other errors propagate (correct)
- The extra test added beyond tasks.md ("QR not in DB → 404 for proxy route") is a genuine gap fix, not defensive code

---

## Verdict

**ready for /qa**
