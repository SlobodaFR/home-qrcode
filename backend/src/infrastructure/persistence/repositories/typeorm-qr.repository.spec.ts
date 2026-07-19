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

  const makeQrFull = (id: string, userId: string, createdAt: Date) =>
    QrCode.create({ id, userId, contentType: 'url', content: 'https://x.com', size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M', createdAt });

  // Test 3 — TPP: constant
  it('findAllByUserId() should return empty result for user with no QRs', async () => {
    const result = await repo.findAllByUserId('no-such-user', { page: 1, limit: 20 });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  // Test 4 — TPP: variable
  it('findAllByUserId() should return items ordered by createdAt DESC', async () => {
    await repo.save(makeQrFull('old', 'u-order', new Date('2026-01-01')));
    await repo.save(makeQrFull('new', 'u-order', new Date('2026-06-01')));
    const result = await repo.findAllByUserId('u-order', { page: 1, limit: 20 });
    expect(result.items[0].id).toBe('new');
    expect(result.items[1].id).toBe('old');
  });

  // Test 5 — TPP: conditional
  it('findAllByUserId() should return only QRs belonging to given userId', async () => {
    await repo.save(makeQrFull('u1-qr', 'user-a', new Date()));
    await repo.save(makeQrFull('u2-qr', 'user-b', new Date()));
    const result = await repo.findAllByUserId('user-a', { page: 1, limit: 20 });
    expect(result.items.every(q => q.userId === 'user-a')).toBe(true);
    expect(result.total).toBe(1);
  });

  // Test 6 — TPP: variable
  it('findAllByUserId() should return correct total and paginated slice', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.save(makeQrFull(`pg-${i}`, 'user-pg', new Date(2026, 0, i + 1)));
    }
    const result = await repo.findAllByUserId('user-pg', { page: 2, limit: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(5);
  });

  // Test 7 — TPP: conditional
  it('findAllByUserId() beyond last page should return empty items with correct total', async () => {
    await repo.save(makeQrFull('single', 'user-one', new Date()));
    const result = await repo.findAllByUserId('user-one', { page: 99, limit: 20 });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(1);
  });

  // Test 8 — TPP: constant
  it('deleteById() should return true and remove record when id+userId match', async () => {
    await repo.save(makeQrFull('del-1', 'user-del', new Date()));
    const deleted = await repo.deleteById('del-1', 'user-del');
    expect(deleted).toBe(true);
    expect(await repo.findById('del-1')).toBeNull();
  });

  // Test 9 — TPP: conditional
  it('deleteById() should return false when id not found', async () => {
    const deleted = await repo.deleteById('nonexistent', 'user-del');
    expect(deleted).toBe(false);
  });

  // Test 10 — TPP: conditional
  it('deleteById() should return false when userId does not match', async () => {
    await repo.save(makeQrFull('del-2', 'owner', new Date()));
    const deleted = await repo.deleteById('del-2', 'not-owner');
    expect(deleted).toBe(false);
    expect(await repo.findById('del-2')).not.toBeNull();
  });

  // Logo-overlay: Test 23 — TPP: variable
  it('toDomain() should map encodedContent, hasLogo, and logoMimeType from ORM row', async () => {
    const qr = QrCode.create({
      id: 'logo-qr', userId: 'user-1', contentType: 'wifi', content: 'HomeNet',
      encodedContent: 'WIFI:T:WPA;S:HomeNet;P:pass;;',
      hasLogo: true, logoMimeType: 'image/png',
      size: 200, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'Q',
      createdAt: new Date('2026-01-01'),
    });
    await repo.save(qr);
    const found = await repo.findById('logo-qr');
    expect(found!.encodedContent).toBe('WIFI:T:WPA;S:HomeNet;P:pass;;');
    expect(found!.hasLogo).toBe(true);
    expect(found!.logoMimeType).toBe('image/png');
  });

  // Logo-overlay: Test 24 — TPP: variable
  it('save() should persist encodedContent, hasLogo, and logoMimeType', async () => {
    const qr = QrCode.create({
      id: 'save-logo', userId: 'user-1', contentType: 'text', content: 'Hello',
      encodedContent: 'Hello', hasLogo: false, logoMimeType: null,
      size: 200, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M',
      createdAt: new Date('2026-01-01'),
    });
    await repo.save(qr);
    const found = await repo.findById('save-logo');
    expect(found!.encodedContent).toBe('Hello');
    expect(found!.hasLogo).toBe(false);
    expect(found!.logoMimeType).toBeNull();
  });
});
