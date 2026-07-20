import { QrShare } from './qr-share';

describe('QrShare', () => {
  // T1 — TPP: constant
  it('should return entity with id, qrId, ownerId, recipientId, createdAt', () => {
    const now = new Date();
    const share = QrShare.create({ id: 'sh-1', qrId: 'qr-1', ownerId: 'u-1', recipientId: 'u-2', createdAt: now });
    expect(share.id).toBe('sh-1');
    expect(share.qrId).toBe('qr-1');
    expect(share.ownerId).toBe('u-1');
    expect(share.recipientId).toBe('u-2');
    expect(share.createdAt).toBe(now);
  });
});
