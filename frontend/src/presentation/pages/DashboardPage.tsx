import { FormEvent, useState } from 'react';
import { useDashboard } from '../../application/hooks/useDashboard';
import { CreateQrPayload, QrItem } from '../../infrastructure/api/qr-auth.client';

type ContentType = 'url' | 'text' | 'wifi' | 'email' | 'vcard';

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
          <a href={qr.pngUrl} download={`qr-${qr.id}.png`} className="text-xs text-gray-500 hover:text-gray-900">PNG</a>
          <a href={qr.svgUrl} download={`qr-${qr.id}.svg`} className="text-xs text-gray-500 hover:text-gray-900">SVG</a>
          <a href={`/q/${qr.id}`} target="_blank" rel="noreferrer" className="text-xs text-gray-500 hover:text-gray-900">Page publique</a>
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

function TypeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
    >
      {label}
    </button>
  );
}

function CreateForm({ onCreate }: { onCreate: (payload: CreateQrPayload) => Promise<void> }) {
  const [contentType, setContentType] = useState<ContentType>('url');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // url / text
  const [content, setContent] = useState('');

  // wifi
  const [ssid, setSsid] = useState('');
  const [security, setSecurity] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [password, setPassword] = useState('');

  // email
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // vcard
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vcardEmail, setVcardEmail] = useState('');
  const [org, setOrg] = useState('');

  function buildPayload(): CreateQrPayload | null {
    if (contentType === 'url' || contentType === 'text') {
      if (!content.trim()) return null;
      return { contentType, content: content.trim() };
    }
    if (contentType === 'wifi') {
      if (!ssid.trim()) return null;
      if (security !== 'nopass' && !password.trim()) return null;
      return { contentType: 'wifi', ssid: ssid.trim(), security, password: security !== 'nopass' ? password : undefined };
    }
    if (contentType === 'email') {
      if (!to.trim()) return null;
      return { contentType: 'email', to: to.trim(), subject: subject || undefined, body: body || undefined };
    }
    // vcard
    if (!name.trim()) return null;
    return { contentType: 'vcard', name: name.trim(), phone: phone || undefined, vcardEmail: vcardEmail || undefined, org: org || undefined };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = buildPayload();
    if (!payload) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(payload);
      setContent(''); setSsid(''); setPassword(''); setTo(''); setSubject(''); setBody(''); setName(''); setPhone(''); setVcardEmail(''); setOrg('');
    } catch {
      setError('Erreur lors de la création.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900 transition-colors';
  const fullInputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900 transition-colors';

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 bg-white">
      <div className="flex gap-2 flex-wrap">
        <TypeButton label="URL" active={contentType === 'url'} onClick={() => setContentType('url')} />
        <TypeButton label="Texte" active={contentType === 'text'} onClick={() => setContentType('text')} />
        <TypeButton label="Wi-Fi" active={contentType === 'wifi'} onClick={() => setContentType('wifi')} />
        <TypeButton label="Email" active={contentType === 'email'} onClick={() => setContentType('email')} />
        <TypeButton label="vCard" active={contentType === 'vcard'} onClick={() => setContentType('vcard')} />
      </div>

      {(contentType === 'url' || contentType === 'text') && (
        <div className="flex gap-2">
          <input
            type={contentType === 'url' ? 'url' : 'text'}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={contentType === 'url' ? 'https://...' : 'Votre texte...'}
            className={inputCls}
            required
          />
        </div>
      )}

      {contentType === 'wifi' && (
        <div className="flex flex-col gap-2">
          <input type="text" value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="SSID (nom du réseau)" className={fullInputCls} required />
          <select value={security} onChange={(e) => setSecurity(e.target.value as typeof security)} className={fullInputCls}>
            <option value="WPA">WPA/WPA2</option>
            <option value="WEP">WEP</option>
            <option value="nopass">Aucun (ouvert)</option>
          </select>
          {security !== 'nopass' && (
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={fullInputCls} required />
          )}
        </div>
      )}

      {contentType === 'email' && (
        <div className="flex flex-col gap-2">
          <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Destinataire (to)" className={fullInputCls} required />
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet (subject)" className={fullInputCls} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message (body)" className={fullInputCls} rows={3} />
        </div>
      )}

      {contentType === 'vcard' && (
        <div className="flex flex-col gap-2">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom complet (name)" className={fullInputCls} required />
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone (phone)" className={fullInputCls} />
          <input type="email" value={vcardEmail} onChange={(e) => setVcardEmail(e.target.value)} placeholder="Email" className={fullInputCls} />
          <input type="text" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Organisation (org)" className={fullInputCls} />
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
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
