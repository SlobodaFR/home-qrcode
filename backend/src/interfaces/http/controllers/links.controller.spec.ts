import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { QrCode } from '../../../domain/qr/qr-code';
import { CreateLinkUseCase } from '../../../application/links/create-link.use-case';
import { ListLinksUseCase } from '../../../application/links/list-links.use-case';
import { EditLinkUseCase } from '../../../application/links/edit-link.use-case';
import { DeleteLinkUseCase } from '../../../application/links/delete-link.use-case';
import { LinksController } from './links.controller';
import { CreateOrEditLinkDto } from '../dto/create-or-edit-link.dto';
import { ListQrDto } from '../dto/list-qr.dto';

const mockLink = QrCode.create({
  id: 'sl-1', userId: 'u1', contentType: 'url', content: 'https://target.com',
  source: 'shortlink', size: 0, fgColor: '', bgColor: '', errorCorrection: 'M',
  createdAt: new Date('2026-01-01'), scanCount: 3,
});

const makeController = async () => {
  const module = await Test.createTestingModule({
    controllers: [LinksController],
    providers: [
      { provide: CreateLinkUseCase, useValue: { execute: jest.fn().mockResolvedValue({ link: mockLink }) } },
      { provide: ListLinksUseCase, useValue: { execute: jest.fn().mockResolvedValue({ items: [mockLink], total: 1, page: 1, limit: 20 }) } },
      { provide: EditLinkUseCase, useValue: { execute: jest.fn().mockResolvedValue({ link: mockLink }) } },
      { provide: DeleteLinkUseCase, useValue: { execute: jest.fn().mockResolvedValue(undefined) } },
      { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('https://qrcode.example.com') } },
      { provide: 'SetExpirationUseCase', useValue: { execute: jest.fn().mockResolvedValue({ entity: mockLink }) } },
    ],
  }).compile();
  return {
    controller: module.get(LinksController),
    createUc: module.get<jest.Mocked<CreateLinkUseCase>>(CreateLinkUseCase),
    listUc: module.get<jest.Mocked<ListLinksUseCase>>(ListLinksUseCase),
    editUc: module.get<jest.Mocked<EditLinkUseCase>>(EditLinkUseCase),
    deleteUc: module.get<jest.Mocked<DeleteLinkUseCase>>(DeleteLinkUseCase),
  };
};

const mockUser = { id: 'u1', email: 'a@b.com', name: 'Alice' };

describe('LinksController', () => {
  // url-shortener: Test 26 — TPP: constant
  it('create() should return 201 response shape with computed shortUrl', async () => {
    const { controller } = await makeController();
    const dto = Object.assign(new CreateOrEditLinkDto(), { url: 'https://target.com' });
    const result = await controller.create(dto, mockUser);
    expect(result).toMatchObject({
      id: 'sl-1',
      url: 'https://target.com',
      shortUrl: 'https://qrcode.example.com/r/sl-1',
      scanCount: 3,
    });
    expect(result.createdAt).toBeDefined();
  });

  // url-shortener: Test 27 — TPP: variable
  it('list() should return paginated ShortLinkItem list with shortUrl per item', async () => {
    const { controller } = await makeController();
    const dto = Object.assign(new ListQrDto(), { page: 1, limit: 20 });
    const result = await controller.list(dto, mockUser);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: 'sl-1', url: 'https://target.com', shortUrl: 'https://qrcode.example.com/r/sl-1' });
    expect(result.total).toBe(1);
  });

  // url-shortener: Test 28 — TPP: variable
  it('update() should return updated ShortLinkItem', async () => {
    const { controller } = await makeController();
    const dto = Object.assign(new CreateOrEditLinkDto(), { url: 'https://new.com' });
    const result = await controller.update('sl-1', dto, mockUser);
    expect(result).toMatchObject({ id: 'sl-1', shortUrl: 'https://qrcode.example.com/r/sl-1' });
  });

  // url-shortener: Test 29 — TPP: constant
  it('remove() should return undefined (HTTP 204)', async () => {
    const { controller } = await makeController();
    const result = await controller.remove('sl-1', mockUser);
    expect(result).toBeUndefined();
  });

  // link-expiration: Test 34 — TPP: constant
  it('PATCH :id/expiration should call SetExpirationUseCase with Date parsed from dto.expiresAt', async () => {
    const expiry = new Date('2026-08-25T23:59:59.000Z');
    const setExpirationUseCase = { execute: jest.fn().mockResolvedValue({ entity: mockLink.withExpiration(expiry) }) };
    const module = await Test.createTestingModule({
      controllers: [LinksController],
      providers: [
        { provide: CreateLinkUseCase, useValue: { execute: jest.fn() } },
        { provide: ListLinksUseCase, useValue: { execute: jest.fn() } },
        { provide: EditLinkUseCase, useValue: { execute: jest.fn() } },
        { provide: DeleteLinkUseCase, useValue: { execute: jest.fn() } },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('https://qrcode.example.com') } },
        { provide: 'SetExpirationUseCase', useValue: setExpirationUseCase },
      ],
    }).compile();
    const controller = module.get(LinksController);
    const { SetExpirationDto } = await import('../dto/set-expiration.dto');
    const dto = Object.assign(new SetExpirationDto(), { expiresAt: '2026-08-25' });
    await controller.setExpiration('sl-1', dto, mockUser);
    expect(setExpirationUseCase.execute).toHaveBeenCalledWith({
      id: 'sl-1', userId: 'u1', expiresAt: new Date('2026-08-25T23:59:59.000Z'),
    });
  });

  // link-expiration: Test 35 — TPP: conditional
  it('PATCH :id/expiration with null should call SetExpirationUseCase with null', async () => {
    const setExpirationUseCase = { execute: jest.fn().mockResolvedValue({ entity: mockLink }) };
    const module = await Test.createTestingModule({
      controllers: [LinksController],
      providers: [
        { provide: CreateLinkUseCase, useValue: { execute: jest.fn() } },
        { provide: ListLinksUseCase, useValue: { execute: jest.fn() } },
        { provide: EditLinkUseCase, useValue: { execute: jest.fn() } },
        { provide: DeleteLinkUseCase, useValue: { execute: jest.fn() } },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('https://qrcode.example.com') } },
        { provide: 'SetExpirationUseCase', useValue: setExpirationUseCase },
      ],
    }).compile();
    const controller = module.get(LinksController);
    const { SetExpirationDto } = await import('../dto/set-expiration.dto');
    const dto = Object.assign(new SetExpirationDto(), { expiresAt: null });
    await controller.setExpiration('sl-1', dto, mockUser);
    expect(setExpirationUseCase.execute).toHaveBeenCalledWith({
      id: 'sl-1', userId: 'u1', expiresAt: null,
    });
  });

  // link-expiration: Test 36 — TPP: variable
  it('GET / list response should include expiresAt on each item', async () => {
    const { controller } = await makeController();
    const result = await controller.list({ page: 1, limit: 20 }, mockUser);
    expect(result.items[0]).toHaveProperty('expiresAt');
    expect(result.items[0].expiresAt).toBeNull();
  });
});
