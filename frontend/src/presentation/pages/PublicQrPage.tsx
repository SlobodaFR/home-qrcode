import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { usePublicQr } from '../../application/hooks/usePublicQr';

export function PublicQrPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { state, onImageError } = usePublicQr(id);

  useEffect(() => {
    document.title = 'QR Code';
  }, []);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span role="status" aria-label="Loading">Loading…</span>
      </div>
    );
  }

  if (state === 'notFound') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-gray-500">QR code not found</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">QR temporarily unavailable</h1>
        <p className="text-gray-500">Please try again later</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <img
        src={`/api/qr/${id}/png`}
        alt="QR Code"
        onError={onImageError}
        className="w-64 h-64 object-contain"
      />
      <div className="flex gap-4">
        <a
          href={`/api/qr/${id}/png`}
          download={`qr-${id}.png`}
          className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
        >
          Download PNG
        </a>
        <a
          href={`/api/qr/${id}/svg`}
          download={`qr-${id}.svg`}
          className="rounded border border-gray-900 px-4 py-2 text-gray-900 hover:bg-gray-100"
        >
          Download SVG
        </a>
      </div>
    </div>
  );
}
