# Spec — public-qr-page

## Summary

Unauthenticated public page at `{FRONTEND_URL}/q/{id}` that displays a QR code image and provides PNG + SVG download buttons. No metadata shown beyond the image — minimal, privacy-safe. Accessible to anyone with the link. If the QR does not exist or has been deleted, the page shows a 404 error view. If the QR exists but the image fails to load (MinIO down), the page shows a generic error view distinct from 404.

**Architecture:**
- Backend: new `@Public()` endpoint `GET /api/qr/:id/meta` → 200 `{}` or 404. No new field exposed. Goes in existing `QrController`.
- Frontend: install React Router v7 (first real frontend feature — foundation for all future pages). Route `/q/:id` → `PublicQrPage` component.
- Downloads: HTML `<a download="qr-{id}.png">` attribute — no backend change needed (same-origin, overrides `Content-Disposition: inline`).
- No Open Graph tags (out of scope v1).

---

## User Stories

**US1 — View public QR page**
Given anyone (authenticated or not) with a valid `/q/{id}` link,
When they open the URL in a browser,
Then they see the QR code image and can download PNG and SVG without logging in.

**US2 — 404 on deleted or unknown QR**
Given anyone with a `/q/{id}` link where the QR has been deleted or never existed,
When they open the URL,
Then they see a clear 404 error view — not a blank page, not a spinner.

**US3 — Download PNG**
Given the public QR page is loaded and the image rendered,
When the user clicks "Download PNG",
Then the browser downloads `qr-{id}.png`.

**US4 — Download SVG**
Given the public QR page is loaded and the image rendered,
When the user clicks "Download SVG",
Then the browser downloads `qr-{id}.svg`.

**US5 — Generic error on image load failure**
Given the QR exists in DB but MinIO is down,
When the user opens `/q/{id}`,
Then the page shows a generic error message (not a 404).

---

## Acceptance Criteria

### Backend — new public metadata endpoint

AC1. Given `GET /api/qr/:id/meta` is called without auth cookie, when the backend receives it, then it returns 200 with body `{}` (no 401, no 403). The route is decorated `@Public()`.

AC2. Given `GET /api/qr/:id/meta` is called for a deleted or never-existing id, when the backend processes it, then it returns 404.

AC3. Given `GET /api/qr/:id/meta` returns 200, then the response body contains no `userId`, no `content`, no `createdAt`, no personally identifiable data — only `{}`.

### Backend — SPA serving

AC4. Given `GET /q/{id}` is requested with no auth cookie, when the backend receives it, then it serves `index.html` with HTTP 200 (existing SPA fallback — no code change needed, already verified in E2E).

### Frontend — routing

AC5. Given React Router v7 is installed and `App.tsx` defines a `<Route path="/q/:id">`, when the browser navigates to `/q/{id}`, then `PublicQrPage` mounts with `id` extracted from URL params.

AC6. Given a route that does not match any defined route, when the SPA loads, then a fallback 404 component renders (not a blank page).

### Frontend — page render flow

AC7. Given `PublicQrPage` mounts with a valid `id`, when it calls `GET /api/qr/:id/meta` and receives 200, then the page renders: QR image (`<img src="/api/qr/{id}/png">`), "Download PNG" button, "Download SVG" button.

AC8. Given `PublicQrPage` mounts with any `id`, when it calls `GET /api/qr/:id/meta` and receives 404, then the page renders a clear 404 error view (no image, no download buttons).

AC9. Given `GET /api/qr/:id/meta` returned 200 and the `<img>` fires `onerror`, when this happens, then the page renders a generic error view ("QR temporarily unavailable" or equivalent) — not the 404 view.

AC10. Given any state (loading / rendered / 404 / error), when the page first mounts, then a loading indicator is shown until the first API response arrives (no blank flash).

### Frontend — QR display

AC11. Given the QR image loads successfully, when rendered, then display width is ≥ 256px, aspect ratio 1:1 preserved.

AC12. Given the page renders, when viewed, then `<title>` reads "QR Code" (or includes "QR Code") — not blank.

### Frontend — downloads

AC13. Given the page is rendered with a valid QR, when the user clicks "Download PNG", then the browser initiates a download of `/api/qr/{id}/png` with filename `qr-{id}.png` via `<a href="..." download="qr-{id}.png">`.

AC14. Given the page is rendered with a valid QR, when the user clicks "Download SVG", then the browser initiates a download of `/api/qr/{id}/svg` with filename `qr-{id}.svg` via `<a href="..." download="qr-{id}.svg">`.

AC15. Given any viewport ≥ 375px wide, when the page is rendered, then both download buttons are visible without scrolling.

---

## Out of Scope

- Editing the QR or its target URL from the public page.
- Displaying scan count, creation date, or content on the public page.
- Showing the redirect target URL for URL-type QRs.
- Open Graph / social share meta tags (v2).
- Bulk download (zip of PNG + SVG).
- QR code decoding on the client.
- Authentication-gated "claim this QR" flow.
- Regenerating or customising the QR from the public page.

---

## Edge Cases

E1. **QR deleted after page started loading** — `/meta` returned 200 but `<img>` fires `onerror`. Defined behavior: generic error view (AC9), not 404.

E2. **Valid UUID format, never existed** — `/meta` returns 404. Defined behavior: 404 view, identical to deleted QR (AC8).

E3. **MinIO down, DB record exists** — `/meta` returns 200, `<img>` fires `onerror`. Defined behavior: generic error view (AC9), distinct from 404.

E4. **Malformed or very long id** — React Router extracts only the path segment up to the next `/`. Backend `/meta` call returns 404 for unknown id. Page shows 404 view.

E5. **`text`-type QR** — same page behavior as URL-type. QR image renders, downloads work. No content displayed.

E6. **Direct browser navigation (not via SPA link)** — backend serves `index.html` via SPA fallback; React Router picks up `/q/{id}` on hydration; `PublicQrPage` mounts and calls `/meta` normally.

E7. **`/q/{id}/anything` (extra path segments)** — React Router does not match `/q/:id` route for deeper paths. Falls through to the 404 fallback route.

---

## Open Questions

*(none — all resolved)*

---

## Grill Log

| # | Question | Resolution | Date |
|---|---|---|---|
| OQ1 | Metadata shown beyond image? | **Option A — Minimal**: image + 2 download buttons only, title "QR Code". No contentType, no date, no scan count. | 2026-07-19 |
| OQ2 | Show redirect target URL for URL-type QR? | **No** — resolved by OQ1 (nothing about content shown). No privacy concern. | 2026-07-19 |
| OQ3 | `/meta` exact fields? | **`{}`** — body irrelevant, only HTTP status (200/404) matters. Minimal exposure. | 2026-07-19 |
| OQ4 | MinIO down: "unavailable" vs 404? | **Option A — Generic error** distinct from 404. `/meta` 200 + img onerror → "temporarily unavailable". | 2026-07-19 |
| OQ5 | Open Graph tags v1? | **Out of scope v1** — SSR/per-id HTML too costly for cosmetic benefit. | 2026-07-19 |
| Gap | React Router needed? | **Option A — React Router v7** installed now. First frontend feature; history + generate pages coming in v1. | 2026-07-19 |
