export interface ShortLinkItem {
  id: string;
  url: string;
  shortUrl: string;
  scanCount: number;
  createdAt: string;
}

export interface ShortLinkListResponse {
  items: ShortLinkItem[];
  total: number;
  page: number;
  limit: number;
}

export async function createLink(url: string): Promise<ShortLinkItem> {
  const res = await fetch('/api/links', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`createLink failed: ${res.status}`);
  return res.json() as Promise<ShortLinkItem>;
}

export async function listLinks(page = 1, limit = 20): Promise<ShortLinkListResponse> {
  const res = await fetch(`/api/links?page=${page}&limit=${limit}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`listLinks failed: ${res.status}`);
  return res.json() as Promise<ShortLinkListResponse>;
}

export async function editLink(id: string, url: string): Promise<ShortLinkItem> {
  const res = await fetch(`/api/links/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`editLink failed: ${res.status}`);
  return res.json() as Promise<ShortLinkItem>;
}

export async function deleteLink(id: string): Promise<void> {
  const res = await fetch(`/api/links/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok && res.status !== 204) throw new Error(`deleteLink failed: ${res.status}`);
}
