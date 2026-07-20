export interface ShareItem {
  shareId: string;
  recipientId: string;
  createdAt: string;
}

export interface SharedQrItem {
  id: string;
  content: string;
  pngUrl: string;
  svgUrl: string;
  hasLogo: boolean;
  expiresAt: string | null;
  sharedBy: { id: string; name: string };
}

export async function shareQr(qrId: string, recipientId: string): Promise<ShareItem> {
  const res = await fetch(`/api/qr/${qrId}/shares`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipientId }),
  });
  if (!res.ok) throw new Error(`shareQr failed: ${res.status}`);
  return res.json() as Promise<ShareItem>;
}

export async function unshareQr(qrId: string, shareId: string): Promise<void> {
  const res = await fetch(`/api/qr/${qrId}/shares/${shareId}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error(`unshareQr failed: ${res.status}`);
}

export async function listSharedWithMe(): Promise<SharedQrItem[]> {
  const res = await fetch('/api/qr/shared-with-me', { credentials: 'include' });
  if (!res.ok) throw new Error(`listSharedWithMe failed: ${res.status}`);
  return res.json() as Promise<SharedQrItem[]>;
}
