# Roadmap — home-qrcode

Features ordered by hard dependencies first, then value/risk.

## v1 — MVP

| # | Slug | Description | Depends on | Status |
|---|---|---|---|---|
| 1 | `repo-setup` | Monorepo scaffold (npm workspaces, .nvmrc, Dockerfile, Litestream, GitHub Actions CI) | — | shipped |
| 2 | `auth` | OAuth2 Authorization Code flow via auth.sloboda.fr, JwtAuthGuard (JWKS), httpOnly cookies, logout, disconnect webhook, user upsert | `repo-setup` | shipped |
| 3 | `qr-generate` | Server-side QR generation (PNG ≥ 1024px + SVG), MinIO upload, proxy routes `/api/qr/{id}/png` and `/api/qr/{id}/svg`, params stored in SQLite | `auth` | shipped |
| 4 | `url-redirect` | `GET /r/{id}` unauthenticated 302 redirect, scan counter increment, edit target URL from history | `qr-generate` | shipped |
| 5 | `qr-history` | Auto-save on generation, paginated list (aperçu + date + scan count), delete (DB + MinIO cleanup) | `qr-generate`, `url-redirect` | shipped |
| 6 | `public-qr-page` | `GET /q/{id}` unauthenticated page: display QR, download PNG/SVG buttons; 404 if deleted | `qr-generate` | shipped |

## v2 — Extensions

| # | Slug | Description | Depends on | Status |
|---|---|---|---|---|
| 7 | `extended-content-types` | Wi-Fi, email, vCard content types (static QR, structured form per type) | `qr-generate` | shipped |
| 8 | `logo-overlay` | Optional logo/image at QR center; enforce correction level ≥ Q when logo present | `qr-generate` | pending |
| 9 | `url-shortener` | Standalone short link UI — create `/r/{id}` without QR image; scan counter; appears in history | `url-redirect` | pending |
| 10 | `link-expiration` | Optional `expires_at` on redirects (URL QR + short links); expired `/r/{id}` returns 410 | `url-redirect`, `url-shortener` | pending |
| 11 | `internal-sharing` | Share QR with specific users; "Shared with me" section; recipient can view + download only | `qr-history`, `auth` | pending |
