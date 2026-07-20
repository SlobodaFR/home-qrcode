import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { QrCode } from '../../../domain/qr/qr-code';
import { QrShare } from '../../../domain/qr/qr-share';
import { QrRepository } from '../../../domain/qr/qr.repository';
import { QrShareRepository } from '../../../domain/qr/qr-share.repository';
import { QrStoragePort } from '../../../domain/qr/qr-storage.port';
import { User } from '../../../domain/user/user';
import { UserRepository } from '../../../domain/user/user.repository';
import { AttachLogoUseCase } from '../../../application/qr/attach-logo.use-case';
import { DeleteQrUseCase } from '../../../application/qr/delete-qr.use-case';
import { EditTargetUrlUseCase } from '../../../application/qr/edit-target-url.use-case';
import { GenerateQrUseCase } from '../../../application/qr/generate-qr.use-case';
import { ListQrUseCase } from '../../../application/qr/list-qr.use-case';
import { ShareQrUseCase } from '../../../application/sharing/share-qr.use-case';
import { UnshareQrUseCase } from '../../../application/sharing/unshare-qr.use-case';
import { ListSharedWithMeUseCase } from '../../../application/sharing/list-shared-with-me.use-case';
import { CreateQrDto } from '../dto/create-qr.dto';
import { CreateShareDto } from '../dto/create-share.dto';
import { EditTargetUrlDto } from '../dto/edit-target-url.dto';
import { ListQrDto } from '../dto/list-qr.dto';
import { QrController } from './qr.controller';
import { Readable } from 'stream';

const mockQr = QrCode.create({
  id: 'qr-1', userId: 'user-1', contentType: 'url', content: 'https://example.com',
  size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M',
  createdAt: new Date('2026-01-01'), scanCount: 3,
});

const mockShare = QrShare.create({ id: 'share-1', qrId: 'qr-1', ownerId: 'user-1', recipientId: 'user-2', createdAt: new Date('2026-01-01') });
const mockRecipient = User.create({ id: 'user-2', email: 'b@c.com', name: 'Bob', avatarUrl: '', createdAt: new Date() });

const makeController = async () => {
  const module = await Test.createTestingModule({
    controllers: [QrController],
    providers: [
      { provide: GenerateQrUseCase, useValue: { execute: jest.fn().mockResolvedValue({ qr: mockQr }) } },
      { provide: AttachLogoUseCase, useValue: { execute: jest.fn().mockResolvedValue({ qr: mockQr }) } },
      { provide: EditTargetUrlUseCase, useValue: { execute: jest.fn().mockResolvedValue({ qr: mockQr }) } },
      { provide: ListQrUseCase, useValue: { execute: jest.fn().mockResolvedValue({ items: [mockQr], total: 1, page: 1, limit: 20 }) } },
      { provide: DeleteQrUseCase, useValue: { execute: jest.fn().mockResolvedValue(undefined) } },
      { provide: QrRepository, useValue: { findById: jest.fn().mockResolvedValue(mockQr), findByIdAndUserId: jest.fn().mockResolvedValue(mockQr), findAllByUserId: jest.fn(), findAllLinksByUserId: jest.fn() } },
      { provide: QrStoragePort, useValue: { streamPng: jest.fn().mockResolvedValue(Readable.from(['png'])), streamSvg: jest.fn().mockResolvedValue(Readable.from(['svg'])), streamLogo: jest.fn().mockResolvedValue(Readable.from(['logo'])), exists: jest.fn().mockResolvedValue(true) } },
      { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('https://qrcode.example.com'), get: jest.fn() } },
      { provide: 'SetExpirationUseCase', useValue: { execute: jest.fn().mockResolvedValue({ entity: mockQr }) } },
      { provide: ShareQrUseCase, useValue: { execute: jest.fn().mockResolvedValue({ share: mockShare }) } },
      { provide: UnshareQrUseCase, useValue: { execute: jest.fn().mockResolvedValue(undefined) } },
      { provide: ListSharedWithMeUseCase, useValue: { execute: jest.fn().mockResolvedValue({ items: [] }) } },
      { provide: QrShareRepository, useValue: { findByQrIds: jest.fn().mockResolvedValue([]) } },
      { provide: UserRepository, useValue: { findAll: jest.fn().mockResolvedValue([mockRecipient]), findById: jest.fn() } },
    ],
  }).compile();
  return {
    controller: module.get(QrController),
    useCase: module.get<jest.Mocked<GenerateQrUseCase>>(GenerateQrUseCase),
    editUseCase: module.get<jest.Mocked<EditTargetUrlUseCase>>(EditTargetUrlUseCase),
    listUseCase: module.get<jest.Mocked<ListQrUseCase>>(ListQrUseCase),
    deleteUseCase: module.get<jest.Mocked<DeleteQrUseCase>>(DeleteQrUseCase),
    repo: module.get<jest.Mocked<QrRepository>>(QrRepository),
    storage: module.get<jest.Mocked<QrStoragePort>>(QrStoragePort),
    shareUseCase: module.get<jest.Mocked<ShareQrUseCase>>(ShareQrUseCase),
    unshareUseCase: module.get<jest.Mocked<UnshareQrUseCase>>(UnshareQrUseCase),
    listSharedWithMeUseCase: module.get<jest.Mocked<ListSharedWithMeUseCase>>(ListSharedWithMeUseCase),
    shareRepo: module.get<jest.Mocked<QrShareRepository>>(QrShareRepository),
    userRepo: module.get<jest.Mocked<UserRepository>>(UserRepository),
  };
};

const mockUser = { id: 'user-1', email: 'a@b.com', name: 'Alice' };

describe('QrController', () => {
  // Test 33 — TPP: constant
  it('should return 201 with QrCode response shape on POST /api/qr', async () => {
    const { controller } = await makeController();
    const dto = Object.assign(new CreateQrDto(), { contentType: 'url' as const, content: 'https://example.com', size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M' as const });
    const result = await controller.create(dto, mockUser);
    expect(result).toMatchObject({ id: 'qr-1', pngUrl: '/api/qr/qr-1/png', svgUrl: '/api/qr/qr-1/svg' });
  });

  // Test 34 — TPP: variable
  it('should pass frontendUrl from ConfigService to GenerateQrUseCase command', async () => {
    const { controller, useCase } = await makeController();
    const dto = Object.assign(new CreateQrDto(), { contentType: 'url' as const, content: 'https://example.com', size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M' as const });
    await controller.create(dto, mockUser);
    expect(useCase.execute).toHaveBeenCalledWith(expect.objectContaining({ frontendUrl: 'https://qrcode.example.com' }));
  });

  // Test 35 — TPP: constant
  it('should return QrCode response on GET /api/qr/:id for owner', async () => {
    const { controller } = await makeController();
    const result = await controller.findOne('qr-1', mockUser);
    expect(result).toMatchObject({ id: 'qr-1', userId: 'user-1' });
  });

  // Test 36 — TPP: conditional
  it('should throw NotFoundException on GET /api/qr/:id when QR not found or not owned', async () => {
    const { controller, repo } = await makeController();
    (repo.findByIdAndUserId as jest.Mock).mockResolvedValue(null);
    await expect(controller.findOne('qr-999', mockUser)).rejects.toThrow(NotFoundException);
  });

  // Test 37 — TPP: constant
  it('should return StreamableFile with image/png and correct Content-Disposition on GET /api/qr/:id/png', async () => {
    const { controller } = await makeController();
    const result = await controller.streamPng('qr-1');
    expect(result.options).toMatchObject({ type: 'image/png', disposition: 'inline; filename="qr-qr-1.png"' });
  });

  // Test 38 — TPP: variable
  it('should return StreamableFile with image/svg+xml on GET /api/qr/:id/svg', async () => {
    const { controller } = await makeController();
    const result = await controller.streamSvg('qr-1');
    expect(result.options).toMatchObject({ type: 'image/svg+xml', disposition: 'inline; filename="qr-qr-1.svg"' });
  });

  // Test 39 — TPP: conditional
  it('should throw NotFoundException on GET /api/qr/:id/png when exists() returns false', async () => {
    const { controller, storage } = await makeController();
    (storage.exists as jest.Mock).mockResolvedValue(false);
    await expect(controller.streamPng('qr-1')).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException on GET /api/qr/:id/png when QR not in DB', async () => {
    const { controller, repo } = await makeController();
    (repo.findById as jest.Mock).mockResolvedValue(null);
    await expect(controller.streamPng('nonexistent')).rejects.toThrow(NotFoundException);
  });

  // Test 21 — TPP: constant
  it('should return 200 with updated QrCode response including scanCount on PATCH /api/qr/:id', async () => {
    const { controller } = await makeController();
    const dto = Object.assign(new EditTargetUrlDto(), { content: 'https://new.com' });
    const result = await controller.update('qr-1', dto, mockUser);
    expect(result).toMatchObject({ id: 'qr-1', scanCount: 3 });
  });

  // Test 22 — TPP: variable
  it('toResponse() should include scanCount field', async () => {
    const { controller } = await makeController();
    const dto = Object.assign(new CreateQrDto(), { contentType: 'url' as const, content: 'https://example.com', size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M' as const });
    const result = await controller.create(dto, mockUser);
    expect(result).toHaveProperty('scanCount');
    expect(result.scanCount).toBe(3);
  });

  // Test 23 — TPP: conditional
  it('should propagate NotFoundException from EditTargetUrlUseCase as 404 on PATCH', async () => {
    const { controller, editUseCase } = await makeController();
    (editUseCase.execute as jest.Mock).mockRejectedValue(new NotFoundException());
    const dto = Object.assign(new EditTargetUrlDto(), { content: 'https://x.com' });
    await expect(controller.update('missing', dto, mockUser)).rejects.toThrow(NotFoundException);
  });

  // Test 24 — TPP: conditional
  it('should propagate UnprocessableEntityException from EditTargetUrlUseCase as 422 on PATCH', async () => {
    const { controller, editUseCase } = await makeController();
    (editUseCase.execute as jest.Mock).mockRejectedValue(new UnprocessableEntityException());
    const dto = Object.assign(new EditTargetUrlDto(), { content: 'https://x.com' });
    await expect(controller.update('qr-text', dto, mockUser)).rejects.toThrow(UnprocessableEntityException);
  });

  // Test 25 — TPP: constant
  it('should return 200 with paginated response on GET /api/qr', async () => {
    const { controller } = await makeController();
    const dto = new ListQrDto();
    const result = await controller.list(dto, mockUser);
    expect(result).toMatchObject({ total: 1, page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
  });

  // Test 26 — TPP: variable
  it('toListItemResponse() should truncate content to 80 chars with ellipsis', async () => {
    const longContent = 'https://example.com/' + 'a'.repeat(100);
    const longQr = QrCode.create({
      id: 'qr-long', userId: 'user-1', contentType: 'url', content: longContent,
      size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M', createdAt: new Date(),
    });
    const { controller, listUseCase } = await makeController();
    (listUseCase.execute as jest.Mock).mockResolvedValue({ items: [longQr], total: 1, page: 1, limit: 20 });
    const dto = new ListQrDto();
    const result = await controller.list(dto, mockUser);
    expect(result.items[0].content).toHaveLength(81); // 80 chars + '…'
    expect(result.items[0].content.endsWith('…')).toBe(true);
  });

  // Test 27 — TPP: conditional
  it('toListItemResponse() should not truncate content ≤ 80 chars', async () => {
    const { controller } = await makeController();
    const dto = new ListQrDto();
    const result = await controller.list(dto, mockUser);
    expect(result.items[0].content).toBe('https://example.com');
  });

  // Test 28 — TPP: constant
  it('should return 204 on DELETE /api/qr/:id for owner', async () => {
    const { controller } = await makeController();
    const result = await controller.remove('qr-1', mockUser);
    expect(result).toBeUndefined();
  });

  // Test 29 — TPP: conditional
  it('should propagate NotFoundException from DeleteQrUseCase as 404', async () => {
    const { controller, deleteUseCase } = await makeController();
    (deleteUseCase.execute as jest.Mock).mockRejectedValue(new NotFoundException());
    await expect(controller.remove('qr-999', mockUser)).rejects.toThrow(NotFoundException);
  });

  // Test 30 — TPP: variable
  it('GET /api/qr should pass userId from @CurrentUser() to ListQrUseCase', async () => {
    const { controller, listUseCase } = await makeController();
    const dto = new ListQrDto();
    await controller.list(dto, mockUser);
    expect(listUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
  });

  // Test 36 (extended-content-types) — TPP: conditional
  it('should pass wifi fields through to GenerateQrUseCase command', async () => {
    const { controller, useCase } = await makeController();
    const dto = Object.assign(new CreateQrDto(), {
      contentType: 'wifi' as const, ssid: 'HomeNet', security: 'WPA' as const, password: 'pass',
      size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M' as const,
    });
    await controller.create(dto, mockUser);
    expect(useCase.execute).toHaveBeenCalledWith(expect.objectContaining({
      contentType: 'wifi',
      wifi: { ssid: 'HomeNet', security: 'WPA', password: 'pass' },
    }));
  });

  // Test 37 — TPP: variable
  it('should pass email fields through to GenerateQrUseCase command', async () => {
    const { controller, useCase } = await makeController();
    const dto = Object.assign(new CreateQrDto(), {
      contentType: 'email' as const, to: 'user@example.com', subject: 'Hi',
      size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M' as const,
    });
    await controller.create(dto, mockUser);
    expect(useCase.execute).toHaveBeenCalledWith(expect.objectContaining({
      contentType: 'email',
      emailFields: { to: 'user@example.com', subject: 'Hi', body: undefined },
    }));
  });

  // Test 38 — TPP: variable
  it('should pass vcard fields through to GenerateQrUseCase command', async () => {
    const { controller, useCase } = await makeController();
    const dto = Object.assign(new CreateQrDto(), {
      contentType: 'vcard' as const, name: 'Jane Doe', phone: '+33612345678',
      size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M' as const,
    });
    await controller.create(dto, mockUser);
    expect(useCase.execute).toHaveBeenCalledWith(expect.objectContaining({
      contentType: 'vcard',
      vcard: { name: 'Jane Doe', phone: '+33612345678', email: undefined, org: undefined },
    }));
  });

  // Test 1 (public-qr-page) — TPP: constant
  it('should return {} when findById returns a QR on GET /api/qr/:id/meta', async () => {
    const { controller } = await makeController();
    const result = await controller.getMeta('qr-1');
    expect(result).toEqual({});
  });

  // Test 2 (public-qr-page) — TPP: conditional
  it('should throw NotFoundException on GET /api/qr/:id/meta when QR not found', async () => {
    const { controller, repo } = await makeController();
    (repo.findById as jest.Mock).mockResolvedValue(null);
    await expect(controller.getMeta('unknown')).rejects.toThrow(NotFoundException);
  });

  // link-expiration: Test 30 — TPP: constant
  it('PATCH :id/expiration should call SetExpirationUseCase with Date parsed from dto.expiresAt', async () => {
    const expiry = new Date('2026-08-25T23:59:59.000Z');
    const setExpirationUseCase = { execute: jest.fn().mockResolvedValue({ entity: mockQr.withExpiration(expiry) }) };
    const module = await Test.createTestingModule({
      controllers: [QrController],
      providers: [
        { provide: GenerateQrUseCase, useValue: { execute: jest.fn() } },
        { provide: AttachLogoUseCase, useValue: { execute: jest.fn() } },
        { provide: EditTargetUrlUseCase, useValue: { execute: jest.fn() } },
        { provide: ListQrUseCase, useValue: { execute: jest.fn() } },
        { provide: DeleteQrUseCase, useValue: { execute: jest.fn() } },
        { provide: QrRepository, useValue: { findById: jest.fn(), findByIdAndUserId: jest.fn(), findAllByUserId: jest.fn(), findAllLinksByUserId: jest.fn() } },
        { provide: QrStoragePort, useValue: {} },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn(), get: jest.fn() } },
        { provide: 'SetExpirationUseCase', useValue: setExpirationUseCase },
        { provide: ShareQrUseCase, useValue: { execute: jest.fn() } },
        { provide: UnshareQrUseCase, useValue: { execute: jest.fn() } },
        { provide: ListSharedWithMeUseCase, useValue: { execute: jest.fn() } },
        { provide: QrShareRepository, useValue: { findByQrIds: jest.fn().mockResolvedValue([]) } },
        { provide: UserRepository, useValue: { findAll: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();
    const controller = module.get(QrController);
    const { SetExpirationDto } = await import('../dto/set-expiration.dto');
    const dto = Object.assign(new SetExpirationDto(), { expiresAt: '2026-08-25' });
    await controller.setExpiration('qr-1', dto, mockUser);
    expect(setExpirationUseCase.execute).toHaveBeenCalledWith({
      id: 'qr-1', userId: 'user-1', expiresAt: new Date('2026-08-25T23:59:59.000Z'),
    });
  });

  // link-expiration: Test 31 — TPP: conditional
  it('PATCH :id/expiration with null should call SetExpirationUseCase with null', async () => {
    const setExpirationUseCase = { execute: jest.fn().mockResolvedValue({ entity: mockQr }) };
    const module = await Test.createTestingModule({
      controllers: [QrController],
      providers: [
        { provide: GenerateQrUseCase, useValue: { execute: jest.fn() } },
        { provide: AttachLogoUseCase, useValue: { execute: jest.fn() } },
        { provide: EditTargetUrlUseCase, useValue: { execute: jest.fn() } },
        { provide: ListQrUseCase, useValue: { execute: jest.fn() } },
        { provide: DeleteQrUseCase, useValue: { execute: jest.fn() } },
        { provide: QrRepository, useValue: { findById: jest.fn(), findByIdAndUserId: jest.fn(), findAllByUserId: jest.fn(), findAllLinksByUserId: jest.fn() } },
        { provide: QrStoragePort, useValue: {} },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn(), get: jest.fn() } },
        { provide: 'SetExpirationUseCase', useValue: setExpirationUseCase },
        { provide: ShareQrUseCase, useValue: { execute: jest.fn() } },
        { provide: UnshareQrUseCase, useValue: { execute: jest.fn() } },
        { provide: ListSharedWithMeUseCase, useValue: { execute: jest.fn() } },
        { provide: QrShareRepository, useValue: { findByQrIds: jest.fn().mockResolvedValue([]) } },
        { provide: UserRepository, useValue: { findAll: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();
    const controller = module.get(QrController);
    const { SetExpirationDto } = await import('../dto/set-expiration.dto');
    const dto = Object.assign(new SetExpirationDto(), { expiresAt: null });
    await controller.setExpiration('qr-1', dto, mockUser);
    expect(setExpirationUseCase.execute).toHaveBeenCalledWith({
      id: 'qr-1', userId: 'user-1', expiresAt: null,
    });
  });

  // link-expiration: Test 32 — TPP: variable
  it('GET / list response should include expiresAt on each item', async () => {
    const { controller } = await makeController();
    const result = await controller.list({ page: 1, limit: 20 }, mockUser);
    expect(result.items[0]).toHaveProperty('expiresAt');
    expect(result.items[0].expiresAt).toBeNull();
  });

  // link-expiration: Test 33 — TPP: variable
  it('POST / create response should include expiresAt field', async () => {
    const { controller } = await makeController();
    const dto = Object.assign(new CreateQrDto(), { contentType: 'url' as const, content: 'https://example.com', size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M' as const });
    const result = await controller.create(dto, mockUser);
    expect(result).toHaveProperty('expiresAt');
    expect(result.expiresAt).toBeNull();
  });

  // T30 — TPP: constant
  it('POST /api/qr/:id/shares should call ShareQrUseCase with qrId, ownerId, recipientId and return 201 with {shareId, recipientId, createdAt}', async () => {
    const { controller, shareUseCase } = await makeController();
    const dto = Object.assign(Object.create(Object.prototype), { recipientId: 'user-2' }) as CreateShareDto;
    const result = await controller.createShare('qr-1', dto, mockUser);
    expect(shareUseCase.execute).toHaveBeenCalledWith({ qrId: 'qr-1', ownerId: 'user-1', recipientId: 'user-2' });
    expect(result).toMatchObject({ shareId: 'share-1', recipientId: 'user-2' });
    expect(result.createdAt).toBeDefined();
  });

  // T30a — TPP: conditional
  it('POST /api/qr/:id/shares should propagate ForbiddenException from ShareQrUseCase as 403', async () => {
    const { controller, shareUseCase } = await makeController();
    shareUseCase.execute.mockRejectedValue(new ForbiddenException());
    const dto = Object.assign(Object.create(Object.prototype), { recipientId: 'user-2' }) as CreateShareDto;
    await expect(controller.createShare('qr-1', dto, mockUser)).rejects.toThrow(ForbiddenException);
  });

  // T31 — TPP: constant
  it('DELETE /api/qr/:id/shares/:shareId should call UnshareQrUseCase with shareId, qrId, ownerId and return 204', async () => {
    const { controller, unshareUseCase } = await makeController();
    await controller.removeShare('qr-1', 'share-1', mockUser);
    expect(unshareUseCase.execute).toHaveBeenCalledWith({ shareId: 'share-1', qrId: 'qr-1', ownerId: 'user-1' });
  });

  // T32 — TPP: constant
  it('GET /api/qr/shared-with-me should call ListSharedWithMeUseCase and return flat array with sharedBy field', async () => {
    const { controller, listSharedWithMeUseCase } = await makeController();
    listSharedWithMeUseCase.execute.mockResolvedValue({
      items: [{ qrCode: mockQr, sharedBy: { id: 'user-1', name: 'Alice' } }],
    });
    const result = await controller.sharedWithMe(mockUser);
    expect(listSharedWithMeUseCase.execute).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'qr-1', sharedBy: { id: 'user-1', name: 'Alice' } });
  });

  // T33 — TPP: variable
  it('GET /api/qr list response should include shares: [] on items when no shares exist', async () => {
    const { controller } = await makeController();
    const result = await controller.list(new ListQrDto(), mockUser);
    expect(result.items[0]).toHaveProperty('shares');
    expect(result.items[0].shares).toEqual([]);
  });

  // T34 — TPP: collection
  it('GET /api/qr list response should include shares: [{shareId, recipientId, recipientName}] on items when shares exist', async () => {
    const { controller, shareRepo, userRepo } = await makeController();
    shareRepo.findByQrIds.mockResolvedValue([mockShare]);
    userRepo.findAll.mockResolvedValue([mockRecipient]);
    const result = await controller.list(new ListQrDto(), mockUser);
    expect(result.items[0].shares).toEqual([{ shareId: 'share-1', recipientId: 'user-2', recipientName: 'Bob' }]);
  });

  // T35 — TPP: variable
  it('GET /api/qr/:id should include shares: [] on the single item', async () => {
    const { controller } = await makeController();
    const result = await controller.findOne('qr-1', mockUser);
    expect(result).toHaveProperty('shares');
    expect(result.shares).toEqual([]);
  });

  // T35b — TPP: collection
  it('GET /api/qr/:id should include recipientName in shares when shares are non-empty', async () => {
    const { controller, shareRepo, userRepo } = await makeController();
    shareRepo.findByQrIds.mockResolvedValue([mockShare]);
    userRepo.findAll.mockResolvedValue([mockRecipient]);
    const result = await controller.findOne('qr-1', mockUser);
    expect(result.shares).toEqual([{ shareId: 'share-1', recipientId: 'user-2', recipientName: 'Bob' }]);
  });
});
