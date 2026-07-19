export type QrMetaStatus = { status: 200 } | { status: 404 } | { status: 'error' };

export async function fetchQrMeta(id: string): Promise<QrMetaStatus> {
  try {
    const response = await fetch(`/api/qr/${id}/meta`);
    if (response.status === 200) return { status: 200 };
    if (response.status === 404) return { status: 404 };
    return { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}
