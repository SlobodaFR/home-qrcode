import { useCallback, useEffect, useState } from 'react';
import { QrItem, createQrCode, deleteQrCode, listQrCodes } from '../../infrastructure/api/qr-auth.client';

type DashboardState = 'loading' | 'ready' | 'error';

interface DashboardHook {
  state: DashboardState;
  items: QrItem[];
  total: number;
  create: (contentType: 'url' | 'text', content: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useDashboard(): DashboardHook {
  const [state, setState] = useState<DashboardState>('loading');
  const [items, setItems] = useState<QrItem[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await listQrCodes();
      setItems(res.items);
      setTotal(res.total);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async (contentType: 'url' | 'text', content: string) => {
    const qr = await createQrCode(contentType, content);
    setItems((prev) => [qr, ...prev]);
    setTotal((t) => t + 1);
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteQrCode(id);
    setItems((prev) => prev.filter((q) => q.id !== id));
    setTotal((t) => t - 1);
  }, []);

  return { state, items, total, create, remove };
}
