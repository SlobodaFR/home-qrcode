import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { QrCode } from '../../../domain/qr/qr-code';
import { QrRepository } from '../../../domain/qr/qr.repository';
import { QrStoragePort } from '../../../domain/qr/qr-storage.port';
import { EditTargetUrlUseCase } from '../../../application/qr/edit-target-url.use-case';
import { GenerateQrUseCase } from '../../../application/qr/generate-qr.use-case';
import { CreateQrDto } from '../dto/create-qr.dto';
import { EditTargetUrlDto } from '../dto/edit-target-url.dto';
import { QrController } from './qr.controller';
import { Readable } from 'stream';

const mockQr = QrCode.create({
  id: 'qr-1', userId: 'user-1', contentType: 'url', content: 'https://example.com',
  size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M',
  createdAt: new Date('2026-01-01'), scanCount: 3,
});

const makeController = async () => {
  const module = await Test.createTestingModule({
    controllers: [QrController],
    providers: [
      { provide: GenerateQrUseCase, useValue: { execute: jest.fn().mockResolvedValue({ qr: mockQr }) } },
      { provide: EditTargetUrlUseCase, useValue: { execute: jest.fn().mockResolvedValue({ qr: mockQr }) } },
      { provide: QrRepository, useValue: { findById: jest.fn().mockResolvedValue(mockQr), findByIdAndUserId: jest.fn().mockResolvedValue(mockQr) } },
      { provide: QrStoragePort, useValue: { streamPng: jest.fn().mockResolvedValue(Readable.from(['png'])), streamSvg: jest.fn().mockResolvedValue(Readable.from(['svg'])), exists: jest.fn().mockResolvedValue(true) } },
      { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('https://qrcode.example.com'), get: jest.fn() } },
    ],
  }).compile();
  return {
    controller: module.get(QrController),
    useCase: module.get<jest.Mocked<GenerateQrUseCase>>(GenerateQrUseCase),
    editUseCase: module.get<jest.Mocked<EditTargetUrlUseCase>>(EditTargetUrlUseCase),
    repo: module.get<jest.Mocked<QrRepository>>(QrRepository),
    storage: module.get<jest.Mocked<QrStoragePort>>(QrStoragePort),
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
});
