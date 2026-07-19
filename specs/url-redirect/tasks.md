# Tasks — url-redirect

## Tests

### Group 1 — QrCode entity: scanCount + withContent()

1. [unit] should have scanCount getter returning the value from props — TPP: constant — FLFI: add `scanCount` to `QrCodeProps`, return it in getter
2. [unit] should default scanCount to 0 when not provided in props — TPP: constant — FLFI: make `scanCount` optional in props with default 0
3. [unit] withContent() should return a new QrCode with updated content and same other props — TPP: variable — FLFI: add `withContent(content)` that calls `QrCode.create({...this.props, content})`
4. [unit] withContent() should preserve scanCount from original entity — TPP: variable — FLFI: ensure `{...this.props, content}` includes `scanCount`

### Group 2 — QrRepository: incrementScanCount()

5. [unit] QrRepository abstract class should declare incrementScanCount(id) — TPP: constant — FLFI: add abstract method to QrRepository

### Group 3 — TypeOrmQrRepository: incrementScanCount()

6. [integration] incrementScanCount() should increment scan_count column by 1 atomically — TPP: constant — FLFI: call `this.repository.increment({ id }, 'scanCount', 1)` in implementation
7. [integration] incrementScanCount() on unknown id should not throw (no-op) — TPP: conditional — FLFI: TypeORM increment is a no-op on zero matching rows; no change needed
8. [integration] save() should persist scanCount — TPP: variable — FLFI: add `scanCount: qr.scanCount` to the object passed to `this.repository.save()`
9. [integration] toDomain() should map scan_count column to scanCount — TPP: variable — FLFI: add `scanCount: row.scanCount` to `QrCode.create()` call in `toDomain()`

### Group 4 — RedirectUseCase

10. [unit] should return targetUrl for a url-type QrCode — TPP: constant — FLFI: use case calls findById, returns { targetUrl: qr.content }
11. [unit] should call incrementScanCount fire-and-forget (void, no await) — TPP: variable — FLFI: `void this.repository.incrementScanCount(id)` without await before returning
12. [unit] should throw NotFoundException when id not found — TPP: conditional — FLFI: check findById result, throw if null
13. [unit] should throw NotFoundException for text-type QrCode — TPP: conditional — FLFI: check contentType === 'url', throw NotFoundException if not

### Group 5 — EditTargetUrlUseCase

14. [unit] should return updated QrCode with new content — TPP: constant — FLFI: findByIdAndUserId → withContent(content) → save → return { qr: updated }
15. [unit] should call repository.save with the updated entity — TPP: variable — FLFI: assert save called with QrCode having new content
16. [unit] should throw NotFoundException when QR not found or not owned — TPP: conditional — FLFI: check findByIdAndUserId result, throw if null
17. [unit] should throw UnprocessableEntityException for text-type QrCode — TPP: conditional — FLFI: check qr.contentType, throw UnprocessableEntityException if not 'url'

### Group 6 — EditTargetUrlDto

18. [unit] should pass validation for valid https URL — TPP: constant — FLFI: DTO with @IsUrl() on content field
19. [unit] should fail validation for non-URL content — TPP: conditional — FLFI: test invalid string triggers validation error
20. [unit] should fail validation for http-less URL — TPP: conditional — FLFI: require http/https protocol same as CreateQrDto

### Group 7 — QrController: PATCH /api/qr/:id

21. [unit] should return 200 with updated QrCode response including scanCount on PATCH /api/qr/:id — TPP: constant — FLFI: add `@Patch(':id')` handler, call EditTargetUrlUseCase, return toResponse(qr)
22. [unit] toResponse() should include scanCount field — TPP: variable — FLFI: add `scanCount: qr.scanCount` to toResponse() helper
23. [unit] should propagate NotFoundException from use case as 404 — TPP: conditional — FLFI: NestJS auto-maps NotFoundException; no extra handling
24. [unit] should propagate UnprocessableEntityException from use case as 422 — TPP: conditional — FLFI: NestJS auto-maps UnprocessableEntityException

### Group 8 — RedirectController

25. [unit] should respond 302 with Location header set to targetUrl — TPP: constant — FLFI: @Get(':id') with @Redirect(), call RedirectUseCase, return { url: result.targetUrl, statusCode: 302 }
26. [unit] should have @Public() decorator (no auth check) — TPP: constant — FLFI: add @Public() above @Get(':id')
27. [unit] should propagate NotFoundException from use case as 404 — TPP: conditional — FLFI: NestJS auto-maps; no extra handling

### Group 9 — E2E (app.module.spec.ts)

28. [e2e] GET /r/{id} for url-type QR → 302 with Location header — TPP: variable — FLFI: create a stub QrCode in DB, call GET /r/{id}, assert 302
29. [e2e] GET /r/{id} for unknown id → 404 — TPP: conditional — FLFI: GET /r/nonexistent, assert 404
30. [e2e] GET /r/{id} without auth → 302 (public route, no cookie needed) — TPP: constant — FLFI: assert no 401
31. [e2e] PATCH /api/qr/:id without auth → 401 — TPP: constant — FLFI: assert 401 when no JWT cookie
