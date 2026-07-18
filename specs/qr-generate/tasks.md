# Tasks — qr-generate

## Tests

### Group 1 — QrCode domain entity (leaf)

1. [unit] should create a QrCode with all valid props and expose them via getters — TPP: constant — FLFI: static create() returns instance, all getters return props values
2. [unit] should expose pngUrl and svgUrl as computed paths based on id — TPP: variable — FLFI: add two getter methods that return `/api/qr/${id}/png` and `/api/qr/${id}/svg`

### Group 2 — GenerateQrUseCase (depends on domain ports)

3. [unit] should call generator with content directly for contentType "text" — TPP: constant — FLFI: use case calls generator.generate(cmd.content, opts)
4. [unit] should call generator with `{frontendUrl}/r/{id}` for contentType "url", not the target URL — TPP: conditional — FLFI: branch on contentType; url branch builds encoded content from frontendUrl + generated id
5. [unit] should call storage.uploadPng and storage.uploadSvg with the generated buffers — TPP: variable — FLFI: call both upload methods after generate()
6. [unit] should call repository.save with a QrCode containing the correct props — TPP: variable — FLFI: construct QrCode entity from command + generated id, call save()
7. [unit] should return the saved QrCode — TPP: constant — FLFI: return { qr } from execute()
8. [unit] should propagate error and not call repository.save if uploadPng throws — TPP: conditional — FLFI: let upload error bubble; save is never called
9. [unit] should propagate error and not call repository.save if uploadSvg throws — TPP: conditional — FLFI: same as above for svg upload

### Group 3 — QrcodeImageGenerator (integration, real `qrcode` npm)

10. [integration] should return a non-empty PNG Buffer and a non-empty SVG string for text content — TPP: constant — FLFI: call qrcode.toBuffer() and qrcode.toString('svg'); return { png, svg }
11. [integration] should encode the given string into the QR image (SVG contains expected content marker) — TPP: variable — FLFI: verify SVG output is a string starting with `<svg` or `<?xml`

### Group 4 — MinioQrStorage (unit, mocked MinIO client)

12. [unit] should call putObject with key `qr/{id}/qr.png` and content-type `image/png` on uploadPng — TPP: constant — FLFI: call client.putObject(bucket, `qr/${id}/qr.png`, buffer, size, { 'Content-Type': 'image/png' })
13. [unit] should call putObject with key `qr/{id}/qr.svg` and content-type `image/svg+xml` on uploadSvg — TPP: variable — FLFI: same pattern for svg key
14. [unit] should call getObject with key `qr/{id}/qr.png` on streamPng — TPP: constant — FLFI: call client.getObject(bucket, `qr/${id}/qr.png`) and return the stream
15. [unit] should call getObject with key `qr/{id}/qr.svg` on streamSvg — TPP: variable — FLFI: same for svg
16. [unit] should return true from exists() when statObject succeeds for `qr/{id}/qr.png` — TPP: constant — FLFI: call client.statObject; return true on success
17. [unit] should return false from exists() when statObject throws a NotFound error — TPP: conditional — FLFI: catch specific MinIO "not found" error code, return false

### Group 5 — TypeOrmQrRepository (integration, real SQLite :memory:)

18. [integration] should return null for an unknown id on findById — TPP: constant — FLFI: findOne returns null → return null
19. [integration] should save and retrieve a QrCode by id — TPP: variable — FLFI: save ORM entity, findOne by id, map to domain
20. [integration] should return null from findByIdAndUserId when userId does not match — TPP: conditional — FLFI: findOne({ id, userId }) returns null
21. [integration] should return the QrCode from findByIdAndUserId when both id and userId match — TPP: variable — FLFI: same query returns row, map to domain

### Group 6 — MinioClientService (unit)

22. [unit] should skip health check when NODE_ENV is not "production" — TPP: constant — FLFI: onModuleInit returns early if env !== 'production'
23. [unit] should call bucketExists when NODE_ENV is "production" — TPP: conditional — FLFI: call client.bucketExists(bucket) when env === 'production'
24. [unit] should throw if bucket does not exist in production — TPP: conditional — FLFI: if bucketExists returns false, throw Error

### Group 7 — CreateQrDto validation (unit, real class-validator)

25. [unit] should pass validation for a valid url DTO with all fields — TPP: constant — FLFI: validateSync returns no errors for { contentType: 'url', content: 'https://example.com', size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M' }
26. [unit] should pass validation for a valid text DTO with only required fields — TPP: constant — FLFI: same for { contentType: 'text', content: 'Hello' }
27. [unit] should fail validation when content is empty — TPP: conditional — FLFI: @IsNotEmpty() triggers error
28. [unit] should fail validation when contentType is "url" and content is not http/https — TPP: conditional — FLFI: @ValidateIf + @IsUrl({ protocols: ['http','https'] }) triggers error for 'ftp://x'
29. [unit] should fail validation when fgColor does not match #RRGGBB pattern — TPP: conditional — FLFI: @Matches regex triggers error for 'red'
30. [unit] should fail validation when size is below 128 — TPP: conditional — FLFI: @Min(128) triggers error
31. [unit] should fail validation when size is above 4096 — TPP: conditional — FLFI: @Max(4096) triggers error
32. [unit] should apply defaults: size 1024, fgColor #000000, bgColor #FFFFFF, errorCorrection M — TPP: variable — FLFI: @Transform or default value decorators set defaults when fields omitted

### Group 8 — QrController (unit, mocked use case + storage + repository)

33. [unit] should return 201 with QrCode response shape on POST /api/qr — TPP: constant — FLFI: call use case, map QrCode to response DTO with pngUrl/svgUrl
34. [unit] should pass frontendUrl from ConfigService to GenerateQrUseCase command — TPP: variable — FLFI: controller reads FRONTEND_URL from config, passes as frontendUrl in command
35. [unit] should return 200 with QrCode response on GET /api/qr/:id for owner — TPP: constant — FLFI: call repository.findByIdAndUserId, map to response
36. [unit] should return 404 on GET /api/qr/:id when QR not found or not owned — TPP: conditional — FLFI: findByIdAndUserId returns null → throw NotFoundException
37. [unit] should return StreamableFile with image/png and correct Content-Disposition on GET /api/qr/:id/png — TPP: constant — FLFI: check exists(), streamPng(), return new StreamableFile with type + disposition
38. [unit] should return StreamableFile with image/svg+xml on GET /api/qr/:id/svg — TPP: variable — FLFI: same for svg
39. [unit] should throw NotFoundException on GET /api/qr/:id/png when exists() returns false — TPP: conditional — FLFI: exists() → false → throw NotFoundException

### Group 9 — AppModule E2E (integration, full app boot)

40. [e2e] should return 401 on POST /api/qr without auth cookies — TPP: constant — FLFI: JwtAuthGuard blocks unauthenticated request
41. [e2e] should return 404 on GET /api/qr/nonexistent/png (public route, missing QR) — TPP: conditional — FLFI: @Public() route, exists() returns false → 404
