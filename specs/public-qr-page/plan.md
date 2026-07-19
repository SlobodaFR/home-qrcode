# Plan — public-qr-page

## Architecture

### Backend (minimal)

One new method in `QrController` (`interfaces/http/controllers/qr.controller.ts`):

```
@Public()
@Get(':id/meta')
async getMeta(@Param('id') id: string): Promise<{}>
```

- Calls `this.qrRepository.findById(id)` (already injected).
- Returns `{}` if found, throws `NotFoundException` if null.
- No new use case — the logic is trivial (existence check, no business rule).
- Route order: `:id/meta` is more specific than `:id` (literal suffix); NestJS resolves correctly. Consistent with existing `:id/png` and `:id/svg` pattern.

No changes to domain, application, or infrastructure layers. No new module.

### Frontend (new foundation)

First real frontend feature. Establishes the React Router foundation all future pages will use.

**Layer placement (per CLAUDE.md)**:

```
frontend/src/
  infrastructure/
    api/
      qr.client.ts          # fetch wrapper for /api/qr/:id/meta
  application/
    hooks/
      usePublicQr.ts        # state machine: loading → found | notFound | error
  presentation/
    pages/
      PublicQrPage.tsx      # /q/:id route component
      NotFoundPage.tsx      # * fallback route
  App.tsx                   # BrowserRouter + Routes (replaces placeholder)
  main.tsx                  # unchanged
```

**Router setup in `App.tsx`** (`<BrowserRouter>` confirmed — no data loading needed, migration to `createBrowserRouter` deferred until a route needs a loader):

```tsx
<BrowserRouter>
  <Routes>
    <Route path="/q/:id" element={<PublicQrPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
</BrowserRouter>
```

**`usePublicQr(id)` hook state**:

```ts
type State = 'loading' | 'found' | 'notFound' | 'error'
```

- On mount: `fetch('/api/qr/${id}/meta')`.
- 200 → `'found'`.
- 404 → `'notFound'`.
- Network error or 5xx → `'error'`.
- Image `onerror` event (only reachable from `'found'` state) → `'error'`.

**`PublicQrPage` render tree** (states map 1:1 to AC7–AC10):

| State | Renders |
|---|---|
| `loading` | spinner / skeleton |
| `found` | `<img>` + Download PNG `<a>` + Download SVG `<a>` |
| `notFound` | 404 view |
| `error` | "QR temporarily unavailable" view |

---

## Contracts

### New backend endpoint

```
GET /api/qr/:id/meta
Auth: none (@Public)
200: {}
404: { statusCode: 404, message: 'Not Found' }
```

No new DTO needed — no request body, no response fields beyond status.

### Frontend API client

```ts
// infrastructure/api/qr.client.ts
export async function fetchQrMeta(id: string): Promise<{ status: 200 | 404 | 'error' }>
```

Uses `fetch`, returns a discriminated status rather than throwing — hook decides rendering.

### Hook contract

```ts
// application/hooks/usePublicQr.ts
export function usePublicQr(id: string): {
  state: 'loading' | 'found' | 'notFound' | 'error';
  onImageError: () => void;
}
```

`onImageError` is passed to `<img onError={onImageError}>` — transitions `'found'` → `'error'`.

---

## Data Model

No changes. `QrRepository.findById(id)` already exists and is used by the proxy routes.

---

## Dependencies

### New third-party libraries — **signed off**

| Package | Version | Where | Why |
|---|---|---|---|
| `react-router-dom` | `^7.0.0` | `dependencies` | SPA routing for `/q/:id` and all future pages. Runtime — needed in browser. |
| `@testing-library/react` | `^16.0.0` | `devDependencies` | Component + hook testing (render, renderHook, assertions). Required for TDD discipline per CLAUDE.md. |
| `@testing-library/user-event` | `^14.0.0` | `devDependencies` | Simulates user interactions (click on download buttons). |
| `jsdom` | `^26.0.0` | `devDependencies` | Vitest DOM environment for component tests (`environment: 'jsdom'` in vitest config). |

No new backend dependencies.

---

## Alternatives Considered

**1. `window.location.pathname` parsing instead of React Router**
Rejected — temporary hack. The history page and QR generate form (next v1 features) both need routing. Installing React Router now avoids an immediate refactor.

**2. New `PublicQrController` for `/meta` endpoint**
Rejected — `QrController` already injects `QrRepository`. Adding one `@Get(':id/meta')` method is consistent with the existing `:id/png` and `:id/svg` pattern. A new controller adds boilerplate module wiring with no benefit.

**3. `HEAD /api/qr/:id/png` to check existence (no `/meta` endpoint)**
Rejected — NestJS `StreamableFile` handlers don't automatically handle `HEAD` requests (no explicit HEAD route → 405 or unexpected behavior). The spec (AC12) also requires the 404 state to be triggered by an API response, not just an img `onerror`. A dedicated `/meta` is explicit and testable.

**4. `<img onError>` only (no fetch call, no `/meta`)**
Rejected — violates AC12 ("404 state triggered by API response, not by checking the image load event alone"). An img 404 and a MinIO 500 are indistinguishable via `onerror`; fetching `/meta` first separates "QR deleted" from "QR exists but image unavailable".

**5. `createBrowserRouter` / `RouterProvider` (React Router v7 "new" API) instead of `<BrowserRouter>` + `<Routes>`**
`createBrowserRouter` enables loaders, type-safe routes, and code splitting. Grilled and rejected: no route in this feature needs a data loader, and `<BrowserRouter>` is trivially migratable when the first loader is needed. Deferring is not debt.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| React Router v7 API surface unfamiliar | Low | Medium | Use `<BrowserRouter>` + `<Routes>` — stable, well-documented, no new concepts |
| NestJS route conflict `:id` vs `:id/meta` | Low | High | Same pattern as existing `:id/png` and `:id/svg` — already proven in tests |
| `<img>` CORS on `/api/qr/:id/png` | Low | High | Same-origin (SPA served from same NestJS instance) — no CORS issue |
| `download` attribute on `<a>` doesn't force download for inline Content-Disposition | Low | Low | HTML `download` attribute overrides Content-Disposition in all modern browsers for same-origin |
| Frontend vitest coverage gap | ~~Medium~~ Resolved | — | `@testing-library/react` + `jsdom` added to devDependencies. Component + hook tests covered under TDD. |

---

## Grill Log

| # | Decision | Resolution | Date |
|---|---|---|---|
| JC1 | `<BrowserRouter>` vs `createBrowserRouter` | **`<BrowserRouter>`** — no data loading in this feature; migration is trivial when the first loader is needed. | 2026-07-19 |
| JC2 | `fetchQrMeta` discriminated status vs throw | **Discriminated status** — 404 is a normal business state, not an exception. Explicit, no try/catch, easier to test. | 2026-07-19 |
| Risk | `@testing-library/react` not installed | **Install now** — `@testing-library/react` + `@testing-library/user-event` + `jsdom` added as devDependencies. CLAUDE.md TDD discipline requires component tests. | 2026-07-19 |
