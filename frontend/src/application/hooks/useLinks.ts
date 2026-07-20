import { useCallback, useEffect, useState } from 'react';
import { ShortLinkItem, createLink, deleteLink, editLink, listLinks } from '../../infrastructure/api/links.client';

type LinksState = 'loading' | 'ready' | 'error';

interface LinksHook {
  state: LinksState;
  items: ShortLinkItem[];
  total: number;
  create: (url: string) => Promise<void>;
  edit: (id: string, url: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useLinks(): LinksHook {
  const [state, setState] = useState<LinksState>('loading');
  const [items, setItems] = useState<ShortLinkItem[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await listLinks();
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

  const create = useCallback(async (url: string) => {
    const link = await createLink(url);
    setItems((prev) => [link, ...prev]);
    setTotal((t) => t + 1);
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteLink(id);
    setItems((prev) => prev.filter((l) => l.id !== id));
    setTotal((t) => t - 1);
  }, []);

  const edit = useCallback(async (id: string, url: string) => {
    const updated = await editLink(id, url);
    setItems((prev) => prev.map((l) => (l.id === id ? updated : l)));
  }, []);

  return { state, items, total, create, edit, remove };
}
