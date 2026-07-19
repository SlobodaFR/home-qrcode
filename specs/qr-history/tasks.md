# Tasks — qr-history

## Tests

### Group 1 — QrRepository: findAllByUserId() + deleteById()

1. [unit] QrRepository abstract class should declare findAllByUserId(userId, options) — TPP: constant — FLFI: add abstract method to QrRepository
2. [unit] QrRepository abstract class should declare deleteById(id, userId) — TPP: constant — FLFI: add abstract method returning Promise<boolean>

### Group 2 — TypeOrmQrRepository: findAllByUserId() + deleteById()

3. [integration] findAllByUserId() should return empty result for user with no QRs — TPP: constant — FLFI: implement with findAndCount({ where: { userId }, order: { createdAt: 'DESC' }, skip, take })
4. [integration] findAllByUserId() should return items ordered by createdAt DESC — TPP: variable — FLFI: insert two QRs with different dates, assert order
5. [integration] findAllByUserId() should return only QRs belonging to the given userId — TPP: conditional — FLFI: insert QRs for two users, assert filter
6. [integration] findAllByUserId() should return correct total and paginated slice — TPP: variable — FLFI: insert 5 QRs, query page=2 limit=2, assert items.length=2 total=5
7. [integration] findAllByUserId() beyond last page should return empty items with correct total — TPP: conditional — FLFI: page=99 with 3 items → items=[], total=3
8. [integration] deleteById() should return true and remove record when id+userId match — TPP: constant — FLFI: save then delete, findById returns null
9. [integration] deleteById() should return false when id not found — TPP: conditional — FLFI: delete nonexistent id → returns false
10. [integration] deleteById() should return false when userId does not match — TPP: conditional — FLFI: delete with wrong userId → returns false, record still exists

### Group 3 — QrStoragePort: delete()

11. [unit] QrStoragePort abstract class should declare delete(id) — TPP: constant — FLFI: add abstract delete(id) method

### Group 4 — MinioQrStorage: delete()

12. [unit] delete() should call removeObject for both qr.png and qr.svg keys — TPP: constant — FLFI: implement with Promise.allSettled([removeObject(png), removeObject(svg)])
13. [unit] delete() should not throw when one object removal fails (best-effort) — TPP: conditional — FLFI: mock one removeObject to reject, assert delete() resolves
14. [unit] delete() should not throw when both removals fail — TPP: conditional — FLFI: both mock rejections, assert delete() still resolves

### Group 5 — DeleteQrUseCase

15. [unit] should delete DB record after attempting MinIO delete — TPP: constant — FLFI: use case calls storage.delete then repository.deleteById
16. [unit] should call storage.delete fire-and-forget before repository.deleteById — TPP: variable — FLFI: void storage.delete(id) then await repository.deleteById
17. [unit] should throw NotFoundException when findByIdAndUserId returns null — TPP: conditional — FLFI: check existence first, throw if null
18. [unit] should throw NotFoundException when deleteById returns false (race condition) — TPP: conditional — FLFI: deleteById returns false → throw NotFoundException

### Group 6 — ListQrUseCase

19. [unit] should return paginated result from repository — TPP: constant — FLFI: call findAllByUserId, return { items, total, page, limit }
20. [unit] should pass correct page and limit to repository — TPP: variable — FLFI: assert findAllByUserId called with { page, limit }

### Group 7 — ListQrDto

21. [unit] should pass validation with default values (no params) — TPP: constant — FLFI: DTO with @IsOptional() @IsInt() @Min(1) page=1; @IsOptional() @IsInt() @Min(1) @Max(100) limit=20
22. [unit] should fail validation for page < 1 — TPP: conditional — FLFI: page=0 → validation error
23. [unit] should fail validation for limit=0 — TPP: conditional — FLFI: limit=0 → validation error
24. [unit] should fail validation for limit > 100 — TPP: conditional — FLFI: limit=101 → validation error

### Group 8 — QrController: GET /api/qr + DELETE /api/qr/:id

25. [unit] should return 200 with paginated response on GET /api/qr — TPP: constant — FLFI: add @Get() handler, call ListQrUseCase, return { items: items.map(toListItemResponse), total, page, limit }
26. [unit] toListItemResponse() should truncate content to 80 chars with ellipsis — TPP: variable — FLFI: content.length > 80 → content.slice(0, 80) + '…'
27. [unit] toListItemResponse() should not truncate content ≤ 80 chars — TPP: conditional — FLFI: no truncation when length ≤ 80
28. [unit] should return 204 on DELETE /api/qr/:id for owner — TPP: constant — FLFI: add @Delete(':id') @HttpCode(204) handler, call DeleteQrUseCase
29. [unit] should propagate NotFoundException from DeleteQrUseCase as 404 — TPP: conditional — FLFI: NestJS auto-maps NotFoundException
30. [unit] GET /api/qr should pass userId from @CurrentUser() to ListQrUseCase — TPP: variable — FLFI: assert use case called with correct userId

### Group 9 — E2E (app.module.spec.ts)

31. [e2e] GET /api/qr without auth → 401 — TPP: constant — FLFI: assert 401 when no cookie
32. [e2e] DELETE /api/qr/:id without auth → 401 — TPP: constant — FLFI: assert 401 when no cookie
33. [e2e] GET /api/qr/:id after DELETE → 404 (owner metadata) — TPP: conditional — FLFI: insert QR, delete, assert 404
34. [e2e] GET /api/qr/:id/png after DELETE → 404 (public proxy) — TPP: conditional — FLFI: insert QR, delete, assert 404 on png route
