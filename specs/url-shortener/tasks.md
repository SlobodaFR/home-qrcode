# Tasks — url-shortener

## Tests

### Group A — Domain: `QrCode` entity (`domain/qr/qr-code.ts` + `qr-code.spec.ts`)

1. ✅ [unit] should return null for source when not provided to QrCode.create() — TPP: constant — FLFI: add optional `source` to QrCodeProps, getter returns `props.source ?? null`
2. ✅ [unit] should return 'shortlink' for source when source='shortlink' is provided — TPP: variable — FLFI: getter reads from props directly

### Group B — Application: `GenerateQrUseCase` change (`generate-qr.use-case.spec.ts`)

3. ✅ [unit] GenerateQrUseCase should save QrCode with source='qr' — TPP: variable — FLFI: pass `source: 'qr'` in QrCode.create() call inside execute()

### Group C — Application: `EditTargetUrlUseCase` change (`edit-target-url.use-case.spec.ts`)

4. ✅ [unit] EditTargetUrlUseCase should throw NotFoundException when QrCode has source='shortlink' — TPP: conditional — FLFI: add guard after fetch: `if (qr.source === 'shortlink') throw new NotFoundException()`

### Group D — Application: `CreateLinkUseCase` (`application/links/create-link.use-case.spec.ts`)

5. ✅ [unit] CreateLinkUseCase should call repository.save with a QrCode — TPP: constant — FLFI: hardcode QrCode.create() with sentinel fields, call save, return link
6. ✅ [unit] CreateLinkUseCase should return a QrCode with source='shortlink' and contentType='url' — TPP: variable — FLFI: set source and contentType in QrCode.create()
7. ✅ [unit] CreateLinkUseCase should store the provided url as content — TPP: variable — FLFI: pass cmd.url as content field
8. ✅ [unit] CreateLinkUseCase should set sentinel values (size=0, fgColor='', bgColor='', errorCorrection='M') — TPP: variable — FLFI: hardcode sentinel values in QrCode.create(); they are never exposed in response

### Group E — Application: `ListLinksUseCase` (`application/links/list-links.use-case.spec.ts`)

9. ✅ [unit] ListLinksUseCase should call findAllLinksByUserId with userId and pagination options — TPP: constant — FLFI: delegate entirely to repo.findAllLinksByUserId
10. ✅ [unit] ListLinksUseCase should return result with page and limit echoed back alongside items — TPP: variable — FLFI: spread FindAllResult and append page/limit

### Group F — Application: `EditLinkUseCase` (`application/links/edit-link.use-case.spec.ts`)

11. ✅ [unit] EditLinkUseCase should return QrCode with updated content when link exists — TPP: constant — FLFI: fetch, call withContent(url), save, return link
12. ✅ [unit] EditLinkUseCase should call repository.save with the updated entity — TPP: variable — FLFI: verify save receives entity with new content
13. ✅ [unit] EditLinkUseCase should throw NotFoundException when id not found or not owned — TPP: conditional — FLFI: null check on findByIdAndUserId result
14. ✅ [unit] EditLinkUseCase should throw NotFoundException when source is not 'shortlink' — TPP: conditional — FLFI: add `if (qr.source !== 'shortlink') throw new NotFoundException()` guard

### Group G — Application: `DeleteLinkUseCase` (`application/links/delete-link.use-case.spec.ts`)

15. ✅ [unit] DeleteLinkUseCase should call repository.deleteById when link exists and is a shortlink — TPP: constant — FLFI: fetch, check source, call deleteById
16. ✅ [unit] DeleteLinkUseCase should throw NotFoundException when link not found or not owned — TPP: conditional — FLFI: null check on findByIdAndUserId
17. ✅ [unit] DeleteLinkUseCase should throw NotFoundException when source is not 'shortlink' — TPP: conditional — FLFI: source guard identical to EditLinkUseCase
18. ✅ [unit] DeleteLinkUseCase constructor should only take QrRepository (no QrStoragePort) — TPP: constant — FLFI: use case class has only one constructor parameter; AC7 satisfied by omission of storage dep

### Group H — Infrastructure: `TypeOrmQrRepository` (`typeorm-qr.repository.spec.ts`)

19. ✅ [integration] save() should persist source field and findById() should retrieve it — TPP: variable — FLFI: add `source` column to QrCodeOrmEntity, map in toDomain(); SQLite ALTER TABLE runs via synchronize:true
20. ✅ [integration] findAllByUserId() should exclude rows with source='shortlink' — TPP: conditional — FLFI: replace simple `where:{userId}` with QueryBuilder: `WHERE user_id=:uid AND (source IS NULL OR source != 'shortlink')`
21. ✅ [integration] findAllByUserId() should include rows where source is null (legacy backward compat) — TPP: variable — FLFI: QueryBuilder NULL-safe OR already covers this case
22. ✅ [integration] findAllByUserId() should include rows with source='qr' — TPP: variable — FLFI: `source='qr'` satisfies `source != 'shortlink'` condition
23. ✅ [integration] findAllLinksByUserId() should return empty list for user with no shortlinks — TPP: constant — FLFI: add method to QrRepository abstract class + TypeOrmQrRepository; WHERE userId AND source='shortlink'
24. ✅ [integration] findAllLinksByUserId() should return only shortlinks for the given user — TPP: variable — FLFI: filter returns rows with source='shortlink' and matching userId
25. ✅ [integration] findAllLinksByUserId() should exclude QR codes (source='qr' and source=null) from same user — TPP: conditional — FLFI: WHERE source='shortlink' excludes all non-shortlink rows

### Group I — Interfaces: `LinksController` unit (`interfaces/http/controllers/links.controller.spec.ts`)

26. ✅ [unit] LinksController.create() should return 201 response shape with shortUrl computed from FRONTEND_URL and link id — TPP: constant — FLFI: call CreateLinkUseCase, build `${frontendUrl}/r/${link.id}` as shortUrl
27. ✅ [unit] LinksController.list() should return paginated ShortLinkItem list with shortUrl per item — TPP: variable — FLFI: call ListLinksUseCase, map each QrCode to {id, url:content, shortUrl, scanCount, createdAt}
28. ✅ [unit] LinksController.update() should return updated ShortLinkItem — TPP: variable — FLFI: call EditLinkUseCase, map result to response shape
29. ✅ [unit] LinksController.remove() should return undefined (HTTP 204) — TPP: constant — FLFI: call DeleteLinkUseCase with id+userId; @HttpCode(204) on method

### Group J — E2E: `AppModule` (`app.module.spec.ts`)

30. ✅ [e2e] POST /api/links without auth should return 401 — TPP: constant — FLFI: LinksModule registered in AppModule; endpoint has no @Public; JwtAuthGuard rejects unauthenticated request
31. ✅ [e2e] POST /api/links with valid auth and valid URL should return 201 with {id, url, shortUrl, scanCount, createdAt} — TPP: variable — FLFI: inject fake JWT cookie, POST {url:'https://target.example.com'}, assert 201 and response shape
32. ✅ [e2e] POST /api/links with valid auth and invalid URL should return 400 — TPP: conditional — FLFI: ValidationPipe rejects non-URL string via @IsUrl on CreateOrEditLinkDto
33. ✅ [e2e] GET /api/links without auth should return 401 — TPP: constant — FLFI: no @Public on GET endpoint
34. ✅ [e2e] PATCH /api/links/:id without auth should return 401 — TPP: constant — FLFI: no @Public on PATCH endpoint
35. ✅ [e2e] DELETE /api/links/:id with auth for owner should return 204 — TPP: constant — FLFI: create link then delete it, assert 204
36. ✅ [e2e] GET /r/:id should return 302 to target URL for a shortlink — TPP: variable — FLFI: create shortlink via POST /api/links, then GET /r/:id asserts 302 Location header matches target URL

### Group K — Frontend: `links.client.ts` (`infrastructure/api/links.client.spec.ts`)

37. ✅ [unit] createLink() should POST to /api/links with credentials and {url} body and return ShortLinkItem — TPP: constant — FLFI: fetch POST /api/links with credentials:'include' and JSON body {url}
38. ✅ [unit] listLinks() should GET /api/links with page and limit as query params — TPP: variable — FLFI: fetch GET /api/links?page=N&limit=M with credentials
39. ✅ [unit] editLink() should PATCH /api/links/:id with {url} body — TPP: variable — FLFI: fetch PATCH with credentials and JSON body
40. ✅ [unit] deleteLink() should DELETE /api/links/:id with credentials — TPP: constant — FLFI: fetch DELETE /api/links/:id with credentials:'include'
41. ✅ [unit] createLink() should throw Error when response status is not ok — TPP: conditional — FLFI: check res.ok; if false throw Error with status code

### Group L — Frontend: `useLinks` hook (`application/hooks/useLinks.spec.ts`)

42. ✅ [unit] useLinks() should be in 'loading' state initially — TPP: constant — FLFI: useState('loading') as initial value before first fetch completes
43. ✅ [unit] useLinks() should transition to 'ready' and set items after listLinks resolves — TPP: variable — FLFI: useEffect calls listLinks, on success setItems and setState('ready')
44. ✅ [unit] useLinks() should set state to 'error' when listLinks rejects — TPP: conditional — FLFI: catch block in load() sets setState('error')
45. ✅ [unit] useLinks().create() should prepend new link to items and increment total — TPP: variable — FLFI: call createLink(url), setItems([newLink, ...prev]), setTotal(t+1)
46. ✅ [unit] useLinks().remove() should filter out deleted link and decrement total — TPP: conditional — FLFI: call deleteLink(id), filter items by id, decrement total
47. ✅ [unit] useLinks().edit() should replace edited item in items list — TPP: conditional — FLFI: call editLink(id, url), map items replacing matching id with updated item

### Group M — Frontend: `DashboardPage` LinksSection (`presentation/pages/DashboardPage.spec.tsx`)

48. ✅ [unit] DashboardPage should render a "Liens courts" section heading — TPP: constant — FLFI: add LinksSection component to DashboardPage; render heading text "Liens courts"
49. ✅ [unit] LinksSection should render a URL input and "Créer" button — TPP: constant — FLFI: form with type=url input (data-testid="link-url-input") and submit button
50. ✅ [unit] LinksSection should render each ShortLinkItem with shortUrl and scan count — TPP: variable — FLFI: map useLinks().items to LinkCard components showing shortUrl and scanCount
51. ✅ [unit] LinkCard "Copier" button should call navigator.clipboard.writeText with shortUrl — TPP: constant — FLFI: onClick handler calls clipboard.writeText(item.shortUrl)
52. ✅ [unit] LinkCard edit button should reveal inline URL input — TPP: conditional — FLFI: toggle local edit state; conditionally render URL input + save button
53. ✅ [unit] LinkCard delete button should call remove with the link id — TPP: conditional — FLFI: onClick calls remove(item.id) from useLinks hook
54. ✅ [unit] LinksSection form submission should call create with entered URL and clear input — TPP: variable — FLFI: onSubmit calls create(url), resets input value
55. ✅ [unit] LinksSection should display empty state text when items list is empty — TPP: conditional — FLFI: conditional render "Aucun lien court" when items.length === 0
