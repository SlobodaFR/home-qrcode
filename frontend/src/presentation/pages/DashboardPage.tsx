import { FormEvent, useState } from 'react';
import { useDashboard } from '../../application/hooks/useDashboard';
import { QrItem } from '../../infrastructure/api/qr-auth.client';

function QrCard({ qr, onDelete }: { qr: QrItem; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      onDelete(qr.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex gap-4 rounded-xl border border-gray-200 p-4 bg-white">
      <a href={`/q/${qr.id}`} target="_blank" rel="noreferrer" className="shrink-0">
        <img src={qr.pngUrl} alt="QR Code" className="w-20 h-20 object-contain rounded" />
      </a>
      <div className="flex flex-col flex-1 min-w-0 gap-1">
        <p className="text-sm font-medium text-gray-900 truncate">{qr.content}</p>
        <p className="text-xs text-gray-400">
          {new Date(qr.createdAt).toLocaleDateString('fr-FR')} · {qr.scanCount} scan{qr.scanCount !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-3 mt-auto pt-1">
          <a
            href={qr.pngUrl}
            download={`qr-${qr.id}.png`}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            PNG
          </a>
          <a
            href={qr.svgUrl}
            download={`qr-${qr.id}.svg`}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            SVG
          </a>
          <a
            href={`/q/${qr.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            Page publique
          </a>
        </div>
      </div>
      <button
        onClick={() => void handleDelete()}
        disabled={deleting}
        aria-label="Supprimer"
        className="shrink-0 self-start text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
      >
        ✕
      </button>
    </div>
  );
}

function CreateForm({ onCreate }: { onCreate: (contentType: 'url' | 'text', content: string) => Promise<void> }) {
  const [contentType, setContentType] = useState<'url' | 'text'>('url');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(contentType, content.trim());
      setContent('');
    } catch {
      setError('Erreur lors de la création.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 bg-white">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setContentType('url')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${contentType === 'url' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          URL
        </button>
        <button
          type="button"
          onClick={() => setContentType('text')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${contentType === 'text' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Texte
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type={contentType === 'url' ? 'url' : 'text'}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={contentType === 'url' ? 'https://...' : 'Votre texte...'}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900 transition-colors"
          required
        />
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          {submitting ? '…' : 'Générer'}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}

export function DashboardPage() {
  const { state, items, total, create, remove } = useDashboard();

  function handleLogout() {
    void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).then(() => {
      window.location.replace('/api/auth/login');
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold text-gray-900">QR Codes</h1>
        <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          Se déconnecter
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-4">
        <CreateForm onCreate={create} />

        {state === 'loading' && (
          <p className="text-center text-sm text-gray-400 py-8">Chargement…</p>
        )}

        {state === 'error' && (
          <p className="text-center text-sm text-red-500 py-8">Erreur lors du chargement.</p>
        )}

        {state === 'ready' && items.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">Aucun QR code. Générez-en un ci-dessus.</p>
        )}

        {state === 'ready' && items.length > 0 && (
          <>
            <p className="text-xs text-gray-400">{total} QR code{total !== 1 ? 's' : ''}</p>
            <div className="flex flex-col gap-3">
              {items.map((qr) => (
                <QrCard key={qr.id} qr={qr} onDelete={remove} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
