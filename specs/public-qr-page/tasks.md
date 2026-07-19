# Tasks — public-qr-page

## Tests

### Group 1 — Backend: QrController.getMeta() (unit)

1. [unit] should return {} when findById returns a QR — TPP: constant — FLFI: add `@Public() @Get(':id/meta')` to QrController, call `findById`, return `{}`
2. [unit] should throw NotFoundException when findById returns null — TPP: conditional — FLFI: if `findById` returns null, throw `NotFoundException`

### Group 2 — Backend E2E: GET /api/qr/:id/meta (app.module.spec.ts)

3. [e2e] GET /api/qr/:id/meta without auth for existing QR → 200 — TPP: constant — FLFI: route is `@Public()`, guard skips, repo finds QR, returns 200
4. [e2e] GET /api/qr/:id/meta for unknown id → 404 — TPP: conditional — FLFI: `findById` null → NotFoundException → NestJS 404
5. [e2e] GET /api/qr/:id/meta body is {} (no userId, no content) — TPP: variable — FLFI: assert `res.body` deep-equals `{}`

### Group 3 — Frontend infra: fetchQrMeta() (unit, vitest)

*Prerequisites: install `@testing-library/react`, `@testing-library/user-event`, `jsdom`; add `test: { environment: 'jsdom' }` to `vite.config.ts`.*

6. [unit] should return { status: 200 } when fetch responds 200 — TPP: constant — FLFI: `fetchQrMeta(id)` calls `fetch('/api/qr/${id}/meta')`, returns `{ status: 200 }` on 200
7. [unit] should return { status: 404 } when fetch responds 404 — TPP: conditional — FLFI: check `response.status === 404`, return `{ status: 404 }`
8. [unit] should return { status: 'error' } on 5xx response — TPP: conditional — FLFI: any other status → `{ status: 'error' }`
9. [unit] should return { status: 'error' } on network error (fetch throws) — TPP: conditional — FLFI: wrap fetch in try/catch, return `{ status: 'error' }` on throw

### Group 4 — Frontend application: usePublicQr hook (unit, vitest + renderHook)

10. [unit] should start in loading state — TPP: constant — FLFI: hook initializes `state` to `'loading'` before fetch resolves
11. [unit] should transition to found when fetchQrMeta returns status 200 — TPP: conditional — FLFI: after fetch resolves 200, `state` becomes `'found'`
12. [unit] should transition to notFound when fetchQrMeta returns status 404 — TPP: conditional — FLFI: after fetch resolves 404, `state` becomes `'notFound'`
13. [unit] should transition to error when fetchQrMeta returns status error — TPP: conditional — FLFI: after fetch resolves error, `state` becomes `'error'`
14. [unit] should transition from found to error when onImageError is called — TPP: conditional — FLFI: `onImageError()` sets `state` from `'found'` to `'error'`

### Group 5 — Frontend presentation: NotFoundPage (unit, vitest + render)

15. [unit] should render a 404 message — TPP: constant — FLFI: `NotFoundPage` returns a element containing "404" or "not found" text (case-insensitive)

### Group 6 — Frontend presentation: PublicQrPage (unit, vitest + render)

*Mock `usePublicQr` via `vi.mock` to control state without network.*

16. [unit] should show loading indicator while state is loading — TPP: constant — FLFI: when hook returns `state: 'loading'`, render a loading element
17. [unit] should show QR image with src /api/qr/:id/png when state is found — TPP: constant — FLFI: when `state: 'found'`, render `<img src="/api/qr/{id}/png">`
18. [unit] should show Download PNG anchor with href /api/qr/:id/png and download qr-{id}.png when found — TPP: variable — FLFI: `<a href="/api/qr/{id}/png" download="qr-{id}.png">`
19. [unit] should show Download SVG anchor with href /api/qr/:id/svg and download qr-{id}.svg when found — TPP: variable — FLFI: `<a href="/api/qr/{id}/svg" download="qr-{id}.svg">`
20. [unit] should wire onImageError from hook to img element — TPP: variable — FLFI: `<img onError={onImageError}>` where `onImageError` comes from hook
21. [unit] should show 404 view when state is notFound — TPP: conditional — FLFI: when `state: 'notFound'`, render 404 message, no img, no download links
22. [unit] should show generic error view when state is error — TPP: conditional — FLFI: when `state: 'error'`, render "temporarily unavailable" message, not the 404 message
23. [unit] document title should contain "QR Code" — TPP: variable — FLFI: set `document.title` or render `<title>QR Code</title>` in component

### Group 7 — Frontend: AppRoutes router (unit, vitest + MemoryRouter)

*Export `AppRoutes` from App.tsx (routes only, no BrowserRouter) for testability. `App` wraps `AppRoutes` with `BrowserRouter`.*

24. [unit] should render PublicQrPage for /q/:id path — TPP: constant — FLFI: wrap `AppRoutes` in `MemoryRouter initialEntries={['/q/abc']}`, assert `PublicQrPage` mounts
25. [unit] should render NotFoundPage for unknown path — TPP: conditional — FLFI: wrap `AppRoutes` in `MemoryRouter initialEntries={['/unknown']}`, assert `NotFoundPage` mounts
