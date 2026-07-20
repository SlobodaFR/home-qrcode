import { useEffect, useState } from 'react';
import { listSharedWithMe, SharedQrItem } from '../../infrastructure/api/sharing.client';

type SharedWithMeState = 'loading' | 'ready' | 'error';

interface SharedWithMeHook {
  state: SharedWithMeState;
  items: SharedQrItem[];
}

export function useSharedWithMe(): SharedWithMeHook {
  const [state, setState] = useState<SharedWithMeState>('loading');
  const [items, setItems] = useState<SharedQrItem[]>([]);

  useEffect(() => {
    listSharedWithMe()
      .then((data) => { setItems(data); setState('ready'); })
      .catch(() => { setState('error'); });
  }, []);

  return { state, items };
}
