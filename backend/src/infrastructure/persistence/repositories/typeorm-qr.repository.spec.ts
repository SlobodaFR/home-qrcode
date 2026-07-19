import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QrCode } from '../../../domain/qr/qr-code';
import { RevokedSessionOrmEntity } from '../entities/revoked-session.orm-entity';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { QrCodeOrmEntity } from '../entities/qr-code.orm-entity';
import { TypeOrmQrRepository } from './typeorm-qr.repository';

const makeQr = (overrides: Partial<{ id: string; userId: string }> = {}) =>
  QrCode.create({
    id: overrides.id ?? 'qr-1',
    userId: overrides.userId ?? 'user-1',
    contentType: 'url',
    content: 'https://example.com',
    size: 1024,
    fgColor: '#000000',
    bgColor: '#FFFFFF',
    errorCorrection: 'M',
    createdAt: new Date('2026-01-01'),
  });

describe('TypeOrmQrRepository', () => {
  let repo: TypeOrmQrRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [UserOrmEntity, RevokedSessionOrmEntity, QrCodeOrmEntity],
          synchronize: true,
          enableWAL: false,
        }),
        TypeOrmModule.forFeature([QrCodeOrmEntity]),
      ],
      providers: [TypeOrmQrRepository],
    }).compile();
    repo = module.get(TypeOrmQrRepository);
  });

  // Test 18 — TPP: constant
  it('should return null for an unknown id on findById', async () => {
    expect(await repo.findById('unknown')).toBeNull();
  });

  // Test 19 — TPP: variable
  it('should save and retrieve a QrCode by id', async () => {
    const qr = makeQr();
    await repo.save(qr);
    const found = await repo.findById('qr-1');
    expect(found).not.toBeNull();
    expect(found!.content).toBe('https://example.com');
    expect(found!.userId).toBe('user-1');
    expect(found!.fgColor).toBe('#000000');
  });

  // Test 20 — TPP: conditional
  it('should return null from findByIdAndUserId when userId does not match', async () => {
    await repo.save(makeQr({ userId: 'user-1' }));
    expect(await repo.findByIdAndUserId('qr-1', 'user-2')).toBeNull();
  });

  // Test 21 — TPP: variable
  it('should return the QrCode from findByIdAndUserId when both id and userId match', async () => {
    await repo.save(makeQr({ id: 'qr-1', userId: 'user-1' }));
    const found = await repo.findByIdAndUserId('qr-1', 'user-1');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('qr-1');
  });

  // Test 6 — TPP: constant
  it('incrementScanCount() should increment scan_count column by 1 atomically', async () => {
    await repo.save(makeQr());
    await repo.incrementScanCount('qr-1');
    const found = await repo.findById('qr-1');
    expect(found!.scanCount).toBe(1);
  });

  // Test 7 — TPP: conditional
  it('incrementScanCount() on unknown id should not throw', async () => {
    await expect(repo.incrementScanCount('nonexistent')).resolves.toBeUndefined();
  });

  // Test 8 — TPP: variable
  it('save() should persist scanCount', async () => {
    const qrWithCount = QrCode.create({
      id: 'qr-scan', userId: 'user-1', contentType: 'url', content: 'https://x.com',
      size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M',
      createdAt: new Date('2026-01-01'), scanCount: 42,
    });
    await repo.save(qrWithCount);
    const found = await repo.findById('qr-scan');
    expect(found!.scanCount).toBe(42);
  });

  // Test 9 — TPP: variable
  it('toDomain() should map scan_count column to scanCount', async () => {
    await repo.save(QrCode.create({
      id: 'qr-map', userId: 'user-1', contentType: 'url', content: 'https://x.com',
      size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M',
      createdAt: new Date('2026-01-01'), scanCount: 3,
    }));
    await repo.incrementScanCount('qr-map');
    const found = await repo.findById('qr-map');
    expect(found!.scanCount).toBe(4);
  });
});
