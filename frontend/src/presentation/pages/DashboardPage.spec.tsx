import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { DashboardPage } from './DashboardPage';
import * as hooks from '../../application/hooks/useDashboard';
import * as linksHooks from '../../application/hooks/useLinks';
import * as currentUserHooks from '../../application/hooks/useCurrentUser';
import * as sharedWithMeHooks from '../../application/hooks/useSharedWithMe';
import * as usersClient from '../../infrastructure/api/users.client';
import type { CreateQrPayload } from '../../infrastructure/api/qr-auth.client';
import type { ShortLinkItem } from '../../infrastructure/api/links.client';

const mockCreate = vi.fn();
const mockRemove = vi.fn();
const mockAttachLogo = vi.fn();
const mockSetExpiration = vi.fn();
const mockShare = vi.fn();
const mockUnshare = vi.fn();

const makeQrItem = (overrides = {}) => ({
  id: 'qr-1', contentType: 'url' as const, content: 'https://example.com',
  scanCount: 0, expiresAt: null as string | null, createdAt: '2026-01-01T00:00:00.000Z',
  pngUrl: '/api/qr/qr-1/png', svgUrl: '/api/qr/qr-1/svg',
  hasLogo: false, logoMimeType: null as string | null,
  errorCorrection: 'M' as const,
  shares: [] as Array<{ shareId: string; recipientId: string; recipientName: string }>,
  ...overrides,
});

beforeEach(() => {
  vi.spyOn(hooks, 'useDashboard').mockReturnValue({
    state: 'ready',
    items: [],
    total: 0,
    create: mockCreate,
    remove: mockRemove,
    attachLogo: mockAttachLogo,
    setExpiration: mockSetExpiration,
    share: mockShare,
    unshare: mockUnshare,
  });
  vi.spyOn(currentUserHooks, 'useCurrentUser').mockReturnValue(null);
  vi.spyOn(sharedWithMeHooks, 'useSharedWithMe').mockReturnValue({ state: 'ready', items: [] });
  vi.spyOn(usersClient, 'listUsers').mockResolvedValue([]);
});

afterEach(() => vi.restoreAllMocks());

describe('QrCard logo-overlay', () => {
  // Test 29 — TPP: constant
  it('should show "Ajouter un logo" button when hasLogo is false', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: false })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    expect(screen.getByRole('button', { name: /ajouter un logo/i })).toBeTruthy();
  });

  // Test 30 — TPP: conditional
  it('should not show "Ajouter un logo" button when hasLogo is true', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: true, logoMimeType: 'image/png' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    expect(screen.queryByRole('button', { name: /ajouter un logo/i })).toBeNull();
  });

  // Test 31 — TPP: conditional
  it('should show "SVG (sans logo)" when hasLogo is true and "SVG" otherwise', () => {
    const { unmount } = render(<DashboardPage />);
    unmount();

    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: false })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    const { unmount: u1 } = render(<DashboardPage />);
    expect(screen.getByText('SVG')).toBeTruthy();
    expect(screen.queryByText('SVG (sans logo)')).toBeNull();
    u1();

    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: true, logoMimeType: 'image/png' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    expect(screen.getByText('SVG (sans logo)')).toBeTruthy();
    expect(screen.queryByText(/^SVG$/)).toBeNull();
  });

  // Test 32 — TPP: conditional
  it('should show correction-level notice when errorCorrection is L or M', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: false, errorCorrection: 'M' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /ajouter un logo/i }));
    expect(screen.getByText(/correction.*Q/i)).toBeTruthy();
  });

  // Test 33 — TPP: conditional
  it('should not show correction-level notice when errorCorrection is Q or H', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: false, errorCorrection: 'H' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /ajouter un logo/i }));
    expect(screen.queryByText(/correction.*Q/i)).toBeNull();
  });

  // AC11 — client-side file size check
  it('should show inline error and not call attachLogo when selected file exceeds 2 MB', async () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: false })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /ajouter un logo/i }));
    const oversized = new File([new ArrayBuffer(2_097_153)], 'big.png', { type: 'image/png' });
    const input = screen.getByTestId('logo-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [oversized] } });
    await waitFor(() => expect(screen.getByText(/2\s*MB/i)).toBeTruthy());
    expect(mockAttachLogo).not.toHaveBeenCalled();
  });

  // AC11 — logo thumbnail when hasLogo is true
  it('should show logo thumbnail img with src /api/qr/:id/logo when hasLogo is true', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ id: 'qr-logo', hasLogo: true, logoMimeType: 'image/png' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    const logoImg = screen.getByAltText(/logo/i) as HTMLImageElement;
    expect(logoImg.src).toContain('/api/qr/qr-logo/logo');
  });
});

describe('CreateForm', () => {
  // Test 47 — TPP: constant
  it('should render Wi-Fi, Email, vCard type buttons in the form', () => {
    render(<DashboardPage />);
    expect(screen.getByRole('button', { name: /wi-fi/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /email/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /vcard/i })).toBeTruthy();
  });

  // Test 48 — TPP: conditional
  it('should render ssid, security select, and password inputs when Wi-Fi is selected', () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /wi-fi/i }));
    expect(screen.getByPlaceholderText(/ssid/i)).toBeTruthy();
    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getByPlaceholderText(/password/i)).toBeTruthy();
  });

  // Test 49 — TPP: conditional
  it('should hide password input when security select is set to nopass', () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /wi-fi/i }));
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'nopass' } });
    expect(screen.queryByPlaceholderText(/password/i)).toBeNull();
  });

  // Test 50 — TPP: conditional
  it('should render to, subject, body inputs when Email is selected', () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /email/i }));
    expect(screen.getByPlaceholderText(/destinataire|to|recipient/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/sujet|subject/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/message|body/i)).toBeTruthy();
  });

  // Test 51 — TPP: conditional
  it('should render name, phone, email, org inputs when vCard is selected', () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /vcard/i }));
    expect(screen.getByPlaceholderText(/nom|name/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/t[ée]l[ée]phone|phone/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/email/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/organisation|org/i)).toBeTruthy();
  });

  it('should send vcardEmail (not email) in vcard payload to match backend DTO field name', async () => {
    mockCreate.mockResolvedValue(undefined);
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /vcard/i }));
    fireEvent.change(screen.getByPlaceholderText(/nom|name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByPlaceholderText(/^email$/i), { target: { value: 'jane@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /g[ée]n[ée]rer/i }));
    await waitFor(() => {
      const call = mockCreate.mock.calls[0][0] as CreateQrPayload;
      expect(call).toMatchObject({ contentType: 'vcard', name: 'Jane Doe', vcardEmail: 'jane@example.com' });
      expect(call).not.toHaveProperty('email');
    });
  });

  // Test 52 — TPP: conditional
  it('should call onCreate with wifi CreateQrPayload on form submit', async () => {
    mockCreate.mockResolvedValue(undefined);
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /wi-fi/i }));
    fireEvent.change(screen.getByPlaceholderText(/ssid/i), { target: { value: 'HomeNet' } });
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /g[ée]n[ée]rer/i }));
    await waitFor(() => {
      const call = mockCreate.mock.calls[0][0] as CreateQrPayload;
      expect(call).toMatchObject({ contentType: 'wifi', ssid: 'HomeNet', security: 'WPA', password: 'secret' });
    });
  });
});

const mockLinkCreate = vi.fn();
const mockLinkRemove = vi.fn();
const mockLinkEdit = vi.fn();
const mockLinkSetExpiration = vi.fn();

const makeLinkItem = (overrides: Partial<ShortLinkItem> = {}): ShortLinkItem => ({
  id: 'sl-1', url: 'https://target.com', shortUrl: 'http://localhost:5173/r/sl-1',
  scanCount: 2, expiresAt: null, createdAt: '2026-01-01T00:00:00.000Z', ...overrides,
});

const mockLinksHook = (items: ShortLinkItem[] = []) => ({
  state: 'ready' as const, items, total: items.length,
  create: mockLinkCreate, edit: mockLinkEdit, remove: mockLinkRemove,
  setExpiration: mockLinkSetExpiration,
});

describe('LinksSection (url-shortener)', () => {
  beforeEach(() => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook());
  });

  // url-shortener: Test 48 — TPP: constant
  it('should render a "Liens courts" tab button', () => {
    render(<DashboardPage />);
    expect(screen.getByTestId('tab-links')).toBeTruthy();
  });

  // url-shortener: Test 49 — TPP: constant
  it('should render a URL input and "Créer" button in the create form', () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByTestId('tab-links'));
    expect(screen.getByTestId('link-url-input')).toBeTruthy();
    expect(screen.getByRole('button', { name: /créer/i })).toBeTruthy();
  });

  // url-shortener: Test 50 — TPP: variable
  it('should render each ShortLinkItem with shortUrl and scan count', () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem()]));
    render(<DashboardPage />);
    fireEvent.click(screen.getByTestId('tab-links'));
    expect(screen.getByText('http://localhost:5173/r/sl-1')).toBeTruthy();
    expect(screen.getByText(/2 scan/i)).toBeTruthy();
  });

  // url-shortener: Test 51 — TPP: constant
  it('"Copier" button should call navigator.clipboard.writeText with shortUrl', async () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem()]));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<DashboardPage />);
    fireEvent.click(screen.getByTestId('tab-links'));
    fireEvent.click(screen.getByRole('button', { name: /copier/i }));
    expect(writeText).toHaveBeenCalledWith('http://localhost:5173/r/sl-1');
  });

  // url-shortener: Test 52 — TPP: conditional
  it('edit button should reveal inline URL input', async () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem()]));
    render(<DashboardPage />);
    fireEvent.click(screen.getByTestId('tab-links'));
    fireEvent.click(screen.getByRole('button', { name: /modifier/i }));
    expect(screen.getByTestId('link-edit-input')).toBeTruthy();
  });

  // url-shortener: Test 53 — TPP: conditional
  it('delete button should call remove with the link id', async () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem()]));
    mockLinkRemove.mockResolvedValue(undefined);
    render(<DashboardPage />);
    fireEvent.click(screen.getByTestId('tab-links'));
    fireEvent.click(screen.getByRole('button', { name: /supprimer le lien/i }));
    await waitFor(() => expect(mockLinkRemove).toHaveBeenCalledWith('sl-1'));
  });

  // url-shortener: Test 54 — TPP: variable
  it('form submission should call create with entered URL and clear input', async () => {
    mockLinkCreate.mockResolvedValue(undefined);
    render(<DashboardPage />);
    fireEvent.click(screen.getByTestId('tab-links'));
    const input = screen.getByTestId('link-url-input');
    fireEvent.change(input, { target: { value: 'https://new.com' } });
    fireEvent.click(screen.getByRole('button', { name: /créer/i }));
    await waitFor(() => expect(mockLinkCreate).toHaveBeenCalledWith('https://new.com', undefined));
  });

  // url-shortener: Test 55 — TPP: conditional
  it('should display empty state text when items list is empty', () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByTestId('tab-links'));
    expect(screen.getByText(/aucun lien court/i)).toBeTruthy();
  });
});

describe('QrCard expiry UI (link-expiration)', () => {
  beforeEach(() => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook());
  });

  // link-expiration: Test 51 — TPP: constant
  it('QrCard should show "Expire le [date]" text when expiresAt is in the future', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ expiresAt: '2099-12-31T23:59:59.000Z' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    expect(screen.getByText(/expire le/i)).toBeTruthy();
  });

  // link-expiration: Test 52 — TPP: conditional
  it('QrCard should show "Expiré" badge when expiresAt is in the past', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ expiresAt: '2020-01-01T00:00:00.000Z' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    expect(screen.getByText(/expiré/i)).toBeTruthy();
  });

  // link-expiration: Test 53 — TPP: conditional
  it('QrCard should show no expiry indicator when expiresAt is null', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ expiresAt: null })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    expect(screen.queryByText(/expire le/i)).toBeNull();
    expect(screen.queryByText(/^expiré$/i)).toBeNull();
  });

  // link-expiration: Test 54 — TPP: constant
  it('QrCard should render date input with data-testid="expiry-date-input"', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem()], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    expect(screen.getByTestId('expiry-date-input')).toBeTruthy();
  });

  // link-expiration: Test 55 — TPP: variable
  it('QrCard expiry date input onChange should call setExpiration(id, value)', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ id: 'qr-1' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    fireEvent.change(screen.getByTestId('expiry-date-input'), { target: { value: '2026-08-25' } });
    expect(mockSetExpiration).toHaveBeenCalledWith('qr-1', '2026-08-25');
  });

  // link-expiration: Test 56 — TPP: conditional
  it('QrCard should show "Supprimer l\'expiration" button when expiresAt is non-null', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ expiresAt: '2099-12-31T23:59:59.000Z' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    expect(screen.getByRole('button', { name: /supprimer l'expiration/i })).toBeTruthy();
  });

  // link-expiration: Test 57 — TPP: variable
  it('QrCard "Supprimer l\'expiration" button onClick should call setExpiration(id, null)', async () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ id: 'qr-1', expiresAt: '2099-12-31T23:59:59.000Z' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    mockSetExpiration.mockResolvedValue(undefined);
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /supprimer l'expiration/i }));
    await waitFor(() => expect(mockSetExpiration).toHaveBeenCalledWith('qr-1', null));
  });
});

describe('LinkCard expiry UI (link-expiration)', () => {
  beforeEach(() => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook());
  });

  // link-expiration: Test 58 — TPP: constant
  it('LinkCard should show "Expire le [date]" text when expiresAt is in the future', () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem({ expiresAt: '2099-12-31T23:59:59.000Z' })]));
    render(<DashboardPage />);
    fireEvent.click(screen.getByTestId('tab-links'));
    expect(screen.getByText(/expire le/i)).toBeTruthy();
  });

  // link-expiration: Test 59 — TPP: conditional
  it('LinkCard should show "Expiré" badge when expiresAt is in the past', () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem({ expiresAt: '2020-01-01T00:00:00.000Z' })]));
    render(<DashboardPage />);
    fireEvent.click(screen.getByTestId('tab-links'));
    expect(screen.getByText(/expiré/i)).toBeTruthy();
  });

  // link-expiration: Test 60 — TPP: variable
  it('LinkCard date input onChange should call setExpiration(id, value) from useLinks', () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem({ id: 'sl-1' })]));
    render(<DashboardPage />);
    fireEvent.click(screen.getByTestId('tab-links'));
    fireEvent.change(screen.getByTestId('link-expiry-date-input'), { target: { value: '2026-08-25' } });
    expect(mockLinkSetExpiration).toHaveBeenCalledWith('sl-1', '2026-08-25');
  });

  // link-expiration: Test 61 — TPP: conditional
  it('LinkCard "Supprimer l\'expiration" button onClick should call setExpiration(id, null)', async () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem({ id: 'sl-1', expiresAt: '2099-12-31T23:59:59.000Z' })]));
    mockLinkSetExpiration.mockResolvedValue(undefined);
    render(<DashboardPage />);
    fireEvent.click(screen.getByTestId('tab-links'));
    fireEvent.click(screen.getByRole('button', { name: /supprimer l'expiration du lien/i }));
    await waitFor(() => expect(mockLinkSetExpiration).toHaveBeenCalledWith('sl-1', null));
  });

  // link-expiration: Test 62 — TPP: variable
  it('LinksSection CreateForm date input should include expiresAt in create() call when value entered', async () => {
    mockLinkCreate.mockResolvedValue(undefined);
    render(<DashboardPage />);
    fireEvent.click(screen.getByTestId('tab-links'));
    fireEvent.change(screen.getByTestId('link-url-input'), { target: { value: 'https://long.com' } });
    fireEvent.change(screen.getByTestId('link-expiry-create-input'), { target: { value: '2026-08-25' } });
    fireEvent.click(screen.getByRole('button', { name: /créer/i }));
    await waitFor(() => expect(mockLinkCreate).toHaveBeenCalledWith('https://long.com', '2026-08-25'));
  });
});

describe('QR CreateForm expiry UI (link-expiration)', () => {
  beforeEach(() => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook());
  });

  // link-expiration: Test 63 — TPP: variable
  it('QR CreateForm date input should pass expiresAt to onCreate when entered', async () => {
    mockCreate.mockResolvedValue(undefined);
    render(<DashboardPage />);
    fireEvent.change(screen.getByTestId('qr-url-input'), { target: { value: 'https://example.com' } });
    fireEvent.change(screen.getByTestId('qr-expiry-date-input'), { target: { value: '2026-08-25' } });
    fireEvent.click(screen.getByRole('button', { name: /g[ée]n[ée]rer/i }));
    await waitFor(() => {
      const call = mockCreate.mock.calls[0][0] as CreateQrPayload;
      expect(call).toMatchObject({ contentType: 'url', content: 'https://example.com', expiresAt: '2026-08-25' });
    });
    // Note: uses data-testid="qr-url-input" instead of placeholder to avoid collision with LinksSection input
  });
});

const mockSharedItem = {
  id: 'qr-shared-1', content: 'https://example.com',
  pngUrl: '/api/qr/qr-shared-1/png', svgUrl: '/api/qr/qr-shared-1/svg',
  contentType: 'url' as const, errorCorrection: 'M' as const, scanCount: 0,
  expiresAt: null, createdAt: '2026-01-01T00:00:00.000Z', hasLogo: false, logoMimeType: null,
  sharedBy: { id: 'u-1', name: 'Alice' },
};

describe('internal-sharing UI (T50-T62)', () => {
  beforeEach(() => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook());
  });

  // T50 — TPP: constant
  it('should render two tabs: "QR Codes" (tab-qr) and "Liens courts" (tab-links)', () => {
    render(<DashboardPage />);
    expect(screen.getByTestId('tab-qr')).toBeTruthy();
    expect(screen.getByTestId('tab-links')).toBeTruthy();
  });

  // T51 — TPP: conditional
  it('should show QR content and hide LinksSection when "QR Codes" tab is active by default', () => {
    render(<DashboardPage />);
    expect(screen.queryByTestId('link-url-input')).toBeNull();
  });

  // T52 — TPP: conditional
  it('clicking "Liens courts" tab should show LinksSection and hide QR content', () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByTestId('tab-links'));
    expect(screen.getByTestId('link-url-input')).toBeTruthy();
    expect(screen.queryByTestId('qr-url-input')).toBeNull();
  });

  // T53 — TPP: constant
  it('QrCard should render share-user-picker and share-submit-btn', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem()], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo,
      setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    expect(screen.getByTestId('share-user-picker')).toBeTruthy();
    expect(screen.getByTestId('share-submit-btn')).toBeTruthy();
  });

  // T54 — TPP: collection
  it('QrCard with non-empty shares should render share-recipient-{userId} for each recipient', () => {
    const share = { shareId: 'share-1', recipientId: 'user-2', recipientName: 'Bob' };
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ shares: [share] })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo,
      setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    expect(screen.getByTestId('share-recipient-user-2')).toBeTruthy();
  });

  // T55 — TPP: variable
  it('clicking share-submit-btn should call onShare with qrId and selected recipientId from the picker', async () => {
    const recipient = { id: 'user-2', name: 'Bob', email: 'b@c.com', avatarUrl: '' };
    vi.spyOn(usersClient, 'listUsers').mockResolvedValue([recipient]);
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ id: 'qr-1' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo,
      setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    mockShare.mockResolvedValue(undefined);
    render(<DashboardPage />);
    await waitFor(() => {
      const picker = screen.getByTestId('share-user-picker') as HTMLSelectElement;
      expect(picker.options.length).toBeGreaterThan(1);
    });
    fireEvent.change(screen.getByTestId('share-user-picker'), { target: { value: 'user-2' } });
    fireEvent.click(screen.getByTestId('share-submit-btn'));
    await waitFor(() => expect(mockShare).toHaveBeenCalledWith('qr-1', 'user-2'));
  });

  // T56 — TPP: variable
  it('clicking unshare-btn-{userId} should call onUnshare with qrId and shareId', async () => {
    const share = { shareId: 'share-1', recipientId: 'user-2', recipientName: 'Bob' };
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ id: 'qr-1', shares: [share] })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo,
      setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    mockUnshare.mockResolvedValue(undefined);
    render(<DashboardPage />);
    fireEvent.click(screen.getByTestId('unshare-btn-user-2'));
    await waitFor(() => expect(mockUnshare).toHaveBeenCalledWith('qr-1', 'share-1'));
  });

  // T55b — TPP: conditional
  it('QrCard user-picker should not include the current user in options', async () => {
    const self = { id: 'u-1', name: 'Alice', email: 'a@b.com', avatarUrl: '' };
    const other = { id: 'user-2', name: 'Bob', email: 'b@c.com', avatarUrl: '' };
    vi.spyOn(currentUserHooks, 'useCurrentUser').mockReturnValue(self);
    vi.spyOn(usersClient, 'listUsers').mockResolvedValue([self, other]);
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ id: 'qr-1' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo,
      setExpiration: mockSetExpiration, share: mockShare, unshare: mockUnshare,
    });
    render(<DashboardPage />);
    await waitFor(() => {
      const picker = screen.getByTestId('share-user-picker') as HTMLSelectElement;
      const optionValues = Array.from(picker.options).map((o) => o.value);
      expect(optionValues).not.toContain('u-1');
      expect(optionValues).toContain('user-2');
    });
  });

  // T57 — TPP: constant
  it('DashboardPage header should render user-avatar img and user-name from useCurrentUser', () => {
    vi.spyOn(currentUserHooks, 'useCurrentUser').mockReturnValue({ id: 'u-1', name: 'Alice', email: 'a@b.com', avatarUrl: 'https://av.png' });
    render(<DashboardPage />);
    expect(screen.getByTestId('user-avatar')).toBeTruthy();
    expect(screen.getByTestId('user-name').textContent).toBe('Alice');
  });

  // T58 — TPP: conditional
  it('DashboardPage header should render initials placeholder when avatarUrl is empty string', () => {
    vi.spyOn(currentUserHooks, 'useCurrentUser').mockReturnValue({ id: 'u-1', name: 'Alice Doe', email: 'a@b.com', avatarUrl: '' });
    render(<DashboardPage />);
    expect(screen.queryByTestId('user-avatar')).toBeNull();
    expect(screen.getByTestId('user-initials').textContent).toBe('AD');
  });

  // T59 — TPP: constant
  it('DashboardPage should render shared-with-me-section when useSharedWithMe returns items', () => {
    vi.spyOn(sharedWithMeHooks, 'useSharedWithMe').mockReturnValue({ state: 'ready', items: [mockSharedItem] });
    render(<DashboardPage />);
    expect(screen.getByTestId('shared-with-me-section')).toBeTruthy();
  });

  // T60 — TPP: conditional
  it('DashboardPage should not render shared-with-me-section when no shared items', () => {
    render(<DashboardPage />);
    expect(screen.queryByTestId('shared-with-me-section')).toBeNull();
  });

  // T61 — TPP: variable
  it('shared-with-me card should display shared-by-name', () => {
    vi.spyOn(sharedWithMeHooks, 'useSharedWithMe').mockReturnValue({ state: 'ready', items: [mockSharedItem] });
    render(<DashboardPage />);
    expect(screen.getByTestId('shared-by-name').textContent).toBe('Alice');
  });

  // T62 — TPP: conditional
  it('shared-with-me card should have no edit, delete, or share-management controls', () => {
    vi.spyOn(sharedWithMeHooks, 'useSharedWithMe').mockReturnValue({ state: 'ready', items: [mockSharedItem] });
    render(<DashboardPage />);
    const section = screen.getByTestId('shared-with-me-section');
    expect(within(section).queryByTestId('share-user-picker')).toBeNull();
    expect(within(section).queryByTestId('share-submit-btn')).toBeNull();
    expect(within(section).queryByRole('button', { name: /supprimer/i })).toBeNull();
  });
});
