# Spec — qr-generate

## Summary

Server-side QR code generation for two content types (URL, plain text). At creation, backend generates PNG + SVG synchronously and uploads both to MinIO before returning 201; parameters are stored in SQLite. API returns proxy URLs for the files — never raw MinIO URLs. URL-type QR codes always encode `{FRONTEND_URL}/r/{id}` (not the target URL directly) so the target remains editable. PNG and SVG proxy routes are fully public (`@Public()`). MinIO health check is mandatory at startup.

---

## User Stories

**Create a URL QR code**
- Given an authenticated user, when `POST /api/qr` with `{ contentType: "url", content: "https://example.com", size: 1024, fgColor: "#000000", bgColor: "#FFFFFF", errorCorrection: "M" }`, then generate PNG + SVG encoding `{FRONTEND_URL}/r/{id}`, upload both to MinIO at `qr/{id}/qr.png` and `qr/{id}/qr.svg`, persist params in SQLite, return 201 with `{ id, userId, contentType, content, size, fgColor, bgColor, errorCorrection, createdAt, pngUrl: "/api/qr/{id}/png", svgUrl: "/api/qr/{id}/svg" }`.
- Given the same request, `content` stores the target URL (`https://example.com`); the QR image encodes `{FRONTEND_URL}/r/{id}` — never the target URL directly.
- Given optional params are omitted, then defaults apply: `size: 1024`, `fgColor: "#000000"`, `bgColor: "#FFFFFF"`, `errorCorrection: "M"`.

**Create a plain-text QR code**
- Given an authenticated user, when `POST /api/qr` with `{ contentType: "text", content: "Hello world" }`, then generate PNG + SVG encoding `"Hello world"` directly, upload to MinIO, persist params, return 201.

**Download QR image**
- Given any client (unauthenticated), when `GET /api/qr/{id}/png`, then stream the PNG from MinIO with `Content-Type: image/png` and `Content-Disposition: inline; filename="qr-{id}.png"`.
- Given any client, when `GET /api/qr/{id}/svg`, then stream the SVG with `Content-Type: image/svg+xml` and `Content-Disposition: inline; filename="qr-{id}.svg"`.
- Given `{id}` doesn't exist in DB or file missing from MinIO, then 404.

**Get QR metadata**
- Given an authenticated user who owns the QR, when `GET /api/qr/{id}`, then return `{ id, userId, contentType, content, size, fgColor, bgColor, errorCorrection, createdAt, pngUrl, svgUrl }`.
- Given an authenticated user who does NOT own the QR, then 404 (not 403).
- Given unauthenticated request, then 401.

---

## Acceptance Criteria

| # | Criterion |
|---|---|
| 1 | `POST /api/qr` (authenticated) with `{ contentType, content, size?, fgColor?, bgColor?, errorCorrection? }` → 201 with `{ id, userId, contentType, content, size, fgColor, bgColor, errorCorrection, createdAt, pngUrl: "/api/qr/{id}/png", svgUrl: "/api/qr/{id}/svg" }` |
| 2 | For `contentType: "url"`, QR image encodes `{FRONTEND_URL}/r/{id}` — never the target URL; `content` field stores the target URL |
| 3 | For `contentType: "text"`, QR image encodes `content` directly |
| 4 | PNG generated at `size × size` pixels; SVG is a scalable vector exact-match. Library: `qrcode` npm (ISO 18004 standard) |
| 5 | Both PNG and SVG uploaded synchronously to MinIO before 201 is returned. If either upload fails → 500, no DB record created |
| 6 | MinIO keys: `qr/{id}/qr.png` and `qr/{id}/qr.svg` |
| 7 | QR params persisted in SQLite: `id` (UUID v4 PK), `userId` (FK → users.id), `contentType` (`url` \| `text`), `content`, `size`, `fgColor`, `bgColor`, `errorCorrection`, `createdAt` |
| 8 | `GET /api/qr/{id}/png` — `@Public()`, streams PNG from MinIO, `Content-Type: image/png`, `Content-Disposition: inline; filename="qr-{id}.png"` |
| 9 | `GET /api/qr/{id}/svg` — `@Public()`, streams SVG from MinIO, `Content-Type: image/svg+xml`, `Content-Disposition: inline; filename="qr-{id}.svg"` |
| 10 | `GET /api/qr/{id}/png` or `/svg` for unknown `id` or missing MinIO object → 404 |
| 11 | `GET /api/qr/{id}` (authenticated, owner-only) → `{ id, userId, contentType, content, size, fgColor, bgColor, errorCorrection, createdAt, pngUrl, svgUrl }` |
| 12 | `GET /api/qr/{id}` for QR not owned by requesting user → 404 (not 403) |
| 13 | `POST /api/qr` without auth → 401 (JwtAuthGuard) |
| 14 | `fgColor` and `bgColor` are hex strings matching `/^#[0-9A-Fa-f]{6}$/`; defaults `"#000000"` / `"#FFFFFF"` |
| 15 | `errorCorrection` is one of `L \| M \| Q \| H`; default `"M"` |
| 16 | `size` is an integer, `128 ≤ size ≤ 4096`; default `1024` |
| 17 | `content` non-empty string, required. `contentType` must be `"url"` or `"text"` |
| 18 | For `contentType: "url"`, `content` must be a valid URL with `http` or `https` scheme; other schemes → 400 |
| 19 | App refuses to start if MinIO is unreachable (health check at startup — CLAUDE.md non-negotiable #7) |
| 20 | `FRONTEND_URL` env var drives the encoded URL for `contentType: "url"` — no separate `APP_URL` var |

---

## Out of Scope

- Wi-Fi, vCard, email content types (v2)
- GS1 QR codes (supply-chain standard — irrelevant for personal use)
- Logo overlay (v2)
- `/r/{id}` redirect handling (separate `url-redirect` feature)
- `/q/{id}` public page (separate `public-qr-page` feature)
- Scan counter (lives in `url-redirect`)
- History list / delete / pagination (separate `qr-history` feature)
- Editing the target URL (lives in `qr-history`)
- Async/deferred MinIO upload (v1: sync)

---

## Edge Cases

| # | Case | Behavior |
|---|---|---|
| E1 | MinIO upload fails during creation | 500; no DB record persisted (atomic: both uploads must succeed before save) |
| E2 | `size` outside `[128, 4096]` | 400 |
| E3 | `content` is a valid URL but uses `ftp://` or other non-http(s) scheme | 400 |
| E4 | `fgColor` or `bgColor` not matching `#RRGGBB` hex pattern (e.g. `"red"`, `"#GGG"`) | 400 |
| E5 | `fgColor === bgColor` | Accept — user responsibility; QR may be unreadable |
| E6 | `GET /api/qr/{id}/png` where DB record exists but MinIO object missing | 404 |
| E7 | `GET /api/qr/{id}/png` while MinIO is down | 503 (propagate MinIO error as service unavailable) |
| E8 | `GET /api/qr/{id}` by authenticated user who does not own the QR | 404 (not 403 — do not leak existence) |
| E9 | UUID v4 collision on `id` (probability ~10⁻³⁶) | No special handling; DB PK constraint will reject; treat as 500 |

---

## Grill Log

| Question | Resolution | Source |
|---|---|---|
| OQ7: `APP_URL` vs `FRONTEND_URL`? | `FRONTEND_URL` is the single source of truth. CLAUDE.md non-negotiable #6 explicit. No separate `APP_URL` var. | CLAUDE.md + `.env.example` |
| OQ1: upload timing sync vs async? | Sync — both uploads complete before 201. Atomicity > latency; async deferred to later optimisation if needed. | User |
| OQ2: proxy routes truly public? | Fully public (`@Public()`). UUIDs opaque (v4). `/q/{id}` page needs unauthenticated image load. | User |
| OQ3: QR library? GS1 needed? | `qrcode` npm, ISO 18004 standard. GS1 is supply-chain format — irrelevant for personal URL/text QR codes. | User |
| OQ4: MinIO key format? | Nested: `qr/{id}/qr.png`, `qr/{id}/qr.svg`. Enables future per-QR assets (v2 logo overlay) without key migration. | User |
| OQ5: `Content-Disposition` inline vs attachment? | `inline` on both proxy routes. Frontend handles forced download via `<a download>` attribute. | User |
| OQ6: `GET /api/qr/{id}` metadata endpoint in this feature or `qr-history`? | This feature. QrRepository lives here; `qr-history` should not own endpoints on an entity it didn't create. | User |
| Gap A: `GET /api/qr/{id}` for QR owned by another user? | 404 (not 403) — do not leak existence of other users' QR codes. | Implied |
| Gap B: invalid `fgColor`/`bgColor` format? | 400 — must match `/^#[0-9A-Fa-f]{6}$/`. | Implied |
| Gap C: MinIO health check location? | AC19 — first feature to use MinIO; health check at startup enforced here. CLAUDE.md non-negotiable #7. | CLAUDE.md |
