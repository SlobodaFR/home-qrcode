export interface QrItem {
  id: string;
  contentType: 'url' | 'text';
  content: string;
  scanCount: number;
  createdAt: string;
  pngUrl: string;
  svgUrl: string;
}

export interface QrListResponse {
  items: QrItem[];
  total: number;
  page: number;
  limit: number;
}

export async function listQrCodes(page = 1, limit = 20): Promise<QrListResponse> {
  const res = await fetch(`/api/qr?page=${page}&limit=${limit}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`listQrCodes failed: ${res.status}`);
  return res.json() as Promise<QrListResponse>;
}

export async function createQrCode(contentType: 'url' | 'text', content: string): Promise<QrItem> {
  const res = await fetch('/api/qr', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType, content }),
  });
  if (!res.ok) throw new Error(`createQrCode failed: ${res.status}`);
  return res.json() as Promise<QrItem>;
}

export async function deleteQrCode(id: string): Promise<void> {
  const res = await fetch(`/api/qr/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok && res.status !== 204) throw new Error(`deleteQrCode failed: ${res.status}`);
}
