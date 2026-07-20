import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { useDashboard } from '../../application/hooks/useDashboard';
import { useLinks } from '../../application/hooks/useLinks';
import { CreateQrPayload, QrItem } from '../../infrastructure/api/qr-auth.client';
import { ShortLinkItem } from '../../infrastructure/api/links.client';

type ContentType = 'url' | 'text' | 'wifi' | 'email' | 'vcard';

function QrCard({ qr, onDelete, onAttachLogo, onSetExpiration }: {
  qr: QrItem;
  onDelete: (id: string) => void;
  onAttachLogo: (id: string, file: File) => Promise<void>;
  onSetExpiration: (id: string, expiresAt: string | null) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [showLogoPanel, setShowLogoPanel] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleDelete() {
    setDeleting(true);
    try { onDelete(qr.id); } finally { setDeleting(false); }
  }

  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_097_152) {
      setLogoError('Fichier trop volumineux (max 2 MB).');
      return;
    }
    setUploading(true);
    setLogoError(null);
    try {
      await onAttachLogo(qr.id, file);
      setShowLogoPanel(false);
    } catch {
      setLogoError('Erreur lors de l\'upload.');
    } finally {
      setUploading(false);
    }
  }

  const needsCorrectionUpgrade = qr.errorCorrection === 'L' || qr.errorCorrection === 'M';

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 p-4 bg-white gap-3">
      <div className="flex gap-4">
        <div className="shrink-0 flex flex-col gap-1 items-center">
          <a href={`/q/${qr.id}`} target="_blank" rel="noreferrer">
            <img src={qr.pngUrl} alt="QR Code" className="w-20 h-20 object-contain rounded" />
          </a>
          {qr.hasLogo && (
            <img src={`/api/qr/${qr.id}/logo`} alt="Logo" className="w-8 h-8 object-contain rounded" />
          )}
        </div>
        <div className="flex flex-col flex-1 min-w-0 gap-1">
          <p className="text-sm font-medium text-gray-900 truncate">{qr.content}</p>
          <p className="text-xs text-gray-400">
            {new Date(qr.createdAt).toLocaleDateString('fr-FR')} · {qr.scanCount} scan{qr.scanCount !== 1 ? 's' : ''}
          </p>
          {qr.expiresAt && new Date(qr.expiresAt) > new Date() && (
            <p className="text-xs text-amber-600">Expire le {new Date(qr.expiresAt).toLocaleDateString('fr-FR')}</p>
          )}
          {qr.expiresAt && new Date(qr.expiresAt) <= new Date() && (
            <span className="text-xs font-medium text-red-600">Expiré</span>
          )}
          <div className="flex gap-2 items-center">
            <input
              type="date"
              data-testid="expiry-date-input"
              defaultValue={qr.expiresAt ? qr.expiresAt.slice(0, 10) : ''}
              onChange={(e) => void onSetExpiration(qr.id, e.target.value)}
              className="text-xs border border-gray-200 rounded px-1 py-0.5"
            />
            {qr.expiresAt !== null && (
              <button
                type="button"
                aria-label="Supprimer l'expiration"
                onClick={() => void onSetExpiration(qr.id, null)}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                Supprimer l&apos;expiration
              </button>
            )}
          </div>
          <div className="flex gap-3 mt-auto pt-1">
            <a href={qr.pngUrl} download={`qr-${qr.id}.png`} className="text-xs text-gray-500 hover:text-gray-900">PNG</a>
            <a href={qr.svgUrl} download={`qr-${qr.id}.svg`} className="text-xs text-gray-500 hover:text-gray-900">
              {qr.hasLogo ? 'SVG (sans logo)' : 'SVG'}
            </a>
            <a href={`/q/${qr.id}`} target="_blank" rel="noreferrer" className="text-xs text-gray-500 hover:text-gray-900">Page publique</a>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {!qr.hasLogo && (
            <button
              type="button"
              onClick={() => setShowLogoPanel((v) => !v)}
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              Ajouter un logo
            </button>
          )}
          <button
            onClick={() => void handleDelete()}
            disabled={deleting}
            aria-label="Supprimer"
            className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
          >
            ✕
          </button>
        </div>
      </div>
      {showLogoPanel && !qr.hasLogo && (
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
          {needsCorrectionUpgrade && (
            <p className="text-xs text-amber-600">
              Le niveau de correction sera automatiquement passé à Q pour garantir la lisibilité avec le logo.
            </p>
          )}
          <input
            ref={fileRef}
            data-testid="logo-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => void handleLogoChange(e)}
            disabled={uploading}
            className="text-xs text-gray-600"
          />
          {logoError && <p className="text-xs text-red-500">{logoError}</p>}
        </div>
      )}
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
  const [expiresAt, setExpiresAt] = useState('');

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
    const exp = expiresAt || undefined;
    if (contentType === 'url' || contentType === 'text') {
      if (!content.trim()) return null;
      return { contentType, content: content.trim(), expiresAt: exp };
    }
    if (contentType === 'wifi') {
      if (!ssid.trim()) return null;
      if (security !== 'nopass' && !password.trim()) return null;
      return { contentType: 'wifi', ssid: ssid.trim(), security, password: security !== 'nopass' ? password : undefined, expiresAt: exp };
    }
    if (contentType === 'email') {
      if (!to.trim()) return null;
      return { contentType: 'email', to: to.trim(), subject: subject || undefined, body: body || undefined, expiresAt: exp };
    }
    // vcard
    if (!name.trim()) return null;
    return { contentType: 'vcard', name: name.trim(), phone: phone || undefined, vcardEmail: vcardEmail || undefined, org: org || undefined, expiresAt: exp };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = buildPayload();
    if (!payload) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(payload);
      setContent(''); setSsid(''); setPassword(''); setTo(''); setSubject(''); setBody(''); setName(''); setPhone(''); setVcardEmail(''); setOrg(''); setExpiresAt('');
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
            data-testid={contentType === 'url' ? 'qr-url-input' : undefined}
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

      <div className="flex items-center gap-3">
        <input
          type="date"
          data-testid="qr-expiry-date-input"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900 transition-colors"
        />
        <button
          type="submit"
          disabled={submitting}
          className="ml-auto rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          {submitting ? '…' : 'Générer'}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}

function LinkCard({ link, onEdit, onRemove, onSetExpiration }: {
  link: ShortLinkItem;
  onEdit: (id: string, url: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onSetExpiration: (id: string, expiresAt: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editUrl, setEditUrl] = useState(link.url);

  async function handleSave() {
    await onEdit(link.id, editUrl);
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium text-blue-600 truncate">{link.shortUrl}</span>
          <span className="text-xs text-gray-400 truncate">{link.url}</span>
          <span className="text-xs text-gray-400">{link.scanCount} scan{link.scanCount !== 1 ? 's' : ''}</span>
          {link.expiresAt && new Date(link.expiresAt) > new Date() && (
            <span className="text-xs text-amber-600">Expire le {new Date(link.expiresAt).toLocaleDateString('fr-FR')}</span>
          )}
          {link.expiresAt && new Date(link.expiresAt) <= new Date() && (
            <span className="text-xs font-medium text-red-600">Expiré</span>
          )}
          <div className="flex gap-2 items-center">
            <input
              type="date"
              data-testid="link-expiry-date-input"
              defaultValue={link.expiresAt ? link.expiresAt.slice(0, 10) : ''}
              onChange={(e) => void onSetExpiration(link.id, e.target.value)}
              className="text-xs border border-gray-200 rounded px-1 py-0.5"
            />
            {link.expiresAt !== null && (
              <button
                type="button"
                aria-label="Supprimer l'expiration du lien"
                onClick={() => void onSetExpiration(link.id, null)}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                Supprimer l&apos;expiration
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(link.shortUrl)}
            className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded"
          >
            Copier
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded"
          >
            Modifier
          </button>
          <button
            type="button"
            aria-label="Supprimer le lien"
            onClick={() => void onRemove(link.id)}
            className="text-xs text-gray-300 hover:text-red-500 px-1"
          >
            ✕
          </button>
        </div>
      </div>
      {editing && (
        <div className="flex gap-2">
          <input
            data-testid="link-edit-input"
            type="url"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm"
          />
          <button type="button" onClick={() => void handleSave()} className="text-xs text-blue-600 hover:text-blue-800">
            Enregistrer
          </button>
        </div>
      )}
    </div>
  );
}

function LinksSection() {
  const { state, items, total, create, edit, remove, setExpiration } = useLinks();
  const [url, setUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    try {
      await create(url.trim(), expiresAt || undefined);
      setUrl('');
      setExpiresAt('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-700">Liens courts</h2>
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            data-testid="link-url-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900 transition-colors"
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            Créer
          </button>
        </div>
        <input
          data-testid="link-expiry-create-input"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900 transition-colors"
        />
      </form>
      {state === 'loading' && <p className="text-xs text-gray-400">Chargement…</p>}
      {state === 'error' && <p className="text-xs text-red-500">Erreur lors du chargement.</p>}
      {state === 'ready' && items.length === 0 && (
        <p className="text-xs text-gray-400">Aucun lien court.</p>
      )}
      {state === 'ready' && items.length > 0 && (
        <>
          <p className="text-xs text-gray-400">{total} lien{total !== 1 ? 's' : ''}</p>
          <div className="flex flex-col gap-2">
            {items.map((link) => (
              <LinkCard key={link.id} link={link} onEdit={edit} onRemove={remove} onSetExpiration={setExpiration} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { state, items, total, create, remove, attachLogo, setExpiration } = useDashboard();

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

      <main className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-6">
        <section className="flex flex-col gap-4">
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
                  <QrCard key={qr.id} qr={qr} onDelete={remove} onAttachLogo={attachLogo} onSetExpiration={setExpiration} />
                ))}
              </div>
            </>
          )}
        </section>

        <hr className="border-gray-200" />

        <LinksSection />
      </main>
    </div>
  );
}
