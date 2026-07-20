export interface ShareItem {
  shareId: string;
  recipientId: string;
  recipientName: string;
}

export interface QrItem {
  id: string;
  contentType: 'url' | 'text' | 'wifi' | 'email' | 'vcard';
  content: string;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
  scanCount: number;
  expiresAt: string | null;
  createdAt: string;
  pngUrl: string;
  svgUrl: string;
  hasLogo: boolean;
  logoMimeType: string | null;
  shares: ShareItem[];
}

export interface QrListResponse {
  items: QrItem[];
  total: number;
  page: number;
  limit: number;
}

export type CreateQrPayload =
  | { contentType: 'url'; content: string; expiresAt?: string }
  | { contentType: 'text'; content: string; expiresAt?: string }
  | { contentType: 'wifi'; ssid: string; security: 'WPA' | 'WEP' | 'nopass'; password?: string; expiresAt?: string }
  | { contentType: 'email'; to: string; subject?: string; body?: string; expiresAt?: string }
  | { contentType: 'vcard'; name: string; phone?: string; vcardEmail?: string; org?: string; expiresAt?: string };

export async function listQrCodes(page = 1, limit = 20): Promise<QrListResponse> {
  const res = await fetch(`/api/qr?page=${page}&limit=${limit}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`listQrCodes failed: ${res.status}`);
  return res.json() as Promise<QrListResponse>;
}

export async function createQrCode(payload: CreateQrPayload): Promise<QrItem> {
  const res = await fetch('/api/qr', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`createQrCode failed: ${res.status}`);
  return res.json() as Promise<QrItem>;
}

export async function deleteQrCode(id: string): Promise<void> {
  const res = await fetch(`/api/qr/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok && res.status !== 204) throw new Error(`deleteQrCode failed: ${res.status}`);
}

export async function setQrExpiration(id: string, expiresAt: string | null): Promise<QrItem> {
  const res = await fetch(`/api/qr/${id}/expiration`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresAt }),
  });
  if (!res.ok) throw new Error(`setQrExpiration failed: ${res.status}`);
  return res.json() as Promise<QrItem>;
}

export async function attachLogo(id: string, file: File): Promise<QrItem> {
  const form = new FormData();
  form.append('logo', file);
  const res = await fetch(`/api/qr/${id}/logo`, { method: 'POST', credentials: 'include', body: form });
  if (!res.ok) throw new Error(`attachLogo failed: ${res.status}`);
  return res.json() as Promise<QrItem>;
}
