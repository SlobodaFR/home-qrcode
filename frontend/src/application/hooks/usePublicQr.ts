import { useCallback, useEffect, useState } from 'react';
import { fetchQrMeta } from '../../infrastructure/api/qr.client';

type QrState = 'loading' | 'found' | 'notFound' | 'error';

export function usePublicQr(id: string): { state: QrState; onImageError: () => void } {
  const [state, setState] = useState<QrState>('loading');

  useEffect(() => {
    fetchQrMeta(id).then((result) => {
      if (result.status === 200) setState('found');
      else if (result.status === 404) setState('notFound');
      else setState('error');
    });
  }, [id]);

  const onImageError = useCallback(() => setState('error'), []);

  return { state, onImageError };
}
