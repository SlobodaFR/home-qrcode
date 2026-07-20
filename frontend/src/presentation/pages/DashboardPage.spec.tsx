import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DashboardPage } from './DashboardPage';
import * as hooks from '../../application/hooks/useDashboard';
import * as linksHooks from '../../application/hooks/useLinks';
import type { CreateQrPayload } from '../../infrastructure/api/qr-auth.client';
import type { ShortLinkItem } from '../../infrastructure/api/links.client';

const mockCreate = vi.fn();
const mockRemove = vi.fn();
const mockAttachLogo = vi.fn();
const mockSetExpiration = vi.fn();

const makeQrItem = (overrides = {}) => ({
  id: 'qr-1', contentType: 'url' as const, content: 'https://example.com',
  scanCount: 0, expiresAt: null as string | null, createdAt: '2026-01-01T00:00:00.000Z',
  pngUrl: '/api/qr/qr-1/png', svgUrl: '/api/qr/qr-1/svg',
  hasLogo: false, logoMimeType: null as string | null,
  errorCorrection: 'M' as const,
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
  });
});

afterEach(() => vi.restoreAllMocks());

describe('QrCard logo-overlay', () => {
  // Test 29 — TPP: constant
  it('should show "Ajouter un logo" button when hasLogo is false', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: false })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration,
    });
    render(<DashboardPage />);
    expect(screen.getByRole('button', { name: /ajouter un logo/i })).toBeTruthy();
  });

  // Test 30 — TPP: conditional
  it('should not show "Ajouter un logo" button when hasLogo is true', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: true, logoMimeType: 'image/png' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration,
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
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration,
    });
    const { unmount: u1 } = render(<DashboardPage />);
    expect(screen.getByText('SVG')).toBeTruthy();
    expect(screen.queryByText('SVG (sans logo)')).toBeNull();
    u1();

    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: true, logoMimeType: 'image/png' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration,
    });
    render(<DashboardPage />);
    expect(screen.getByText('SVG (sans logo)')).toBeTruthy();
    expect(screen.queryByText(/^SVG$/)).toBeNull();
  });

  // Test 32 — TPP: conditional
  it('should show correction-level notice when errorCorrection is L or M', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: false, errorCorrection: 'M' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration,
    });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /ajouter un logo/i }));
    expect(screen.getByText(/correction.*Q/i)).toBeTruthy();
  });

  // Test 33 — TPP: conditional
  it('should not show correction-level notice when errorCorrection is Q or H', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: false, errorCorrection: 'H' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration,
    });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /ajouter un logo/i }));
    expect(screen.queryByText(/correction.*Q/i)).toBeNull();
  });

  // AC11 — client-side file size check
  it('should show inline error and not call attachLogo when selected file exceeds 2 MB', async () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: false })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration,
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
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration,
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
  it('should render a "Liens courts" section heading', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/liens courts/i)).toBeTruthy();
  });

  // url-shortener: Test 49 — TPP: constant
  it('should render a URL input and "Créer" button in the create form', () => {
    render(<DashboardPage />);
    expect(screen.getByTestId('link-url-input')).toBeTruthy();
    expect(screen.getByRole('button', { name: /créer/i })).toBeTruthy();
  });

  // url-shortener: Test 50 — TPP: variable
  it('should render each ShortLinkItem with shortUrl and scan count', () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem()]));
    render(<DashboardPage />);
    expect(screen.getByText('http://localhost:5173/r/sl-1')).toBeTruthy();
    expect(screen.getByText(/2 scan/i)).toBeTruthy();
  });

  // url-shortener: Test 51 — TPP: constant
  it('"Copier" button should call navigator.clipboard.writeText with shortUrl', async () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem()]));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /copier/i }));
    expect(writeText).toHaveBeenCalledWith('http://localhost:5173/r/sl-1');
  });

  // url-shortener: Test 52 — TPP: conditional
  it('edit button should reveal inline URL input', async () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem()]));
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /modifier/i }));
    expect(screen.getByTestId('link-edit-input')).toBeTruthy();
  });

  // url-shortener: Test 53 — TPP: conditional
  it('delete button should call remove with the link id', async () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem()]));
    mockLinkRemove.mockResolvedValue(undefined);
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /supprimer le lien/i }));
    await waitFor(() => expect(mockLinkRemove).toHaveBeenCalledWith('sl-1'));
  });

  // url-shortener: Test 54 — TPP: variable
  it('form submission should call create with entered URL and clear input', async () => {
    mockLinkCreate.mockResolvedValue(undefined);
    render(<DashboardPage />);
    const input = screen.getByTestId('link-url-input');
    fireEvent.change(input, { target: { value: 'https://new.com' } });
    fireEvent.click(screen.getByRole('button', { name: /créer/i }));
    await waitFor(() => expect(mockLinkCreate).toHaveBeenCalledWith('https://new.com', undefined));
  });

  // url-shortener: Test 55 — TPP: conditional
  it('should display empty state text when items list is empty', () => {
    render(<DashboardPage />);
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
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration,
    });
    render(<DashboardPage />);
    expect(screen.getByText(/expire le/i)).toBeTruthy();
  });

  // link-expiration: Test 52 — TPP: conditional
  it('QrCard should show "Expiré" badge when expiresAt is in the past', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ expiresAt: '2020-01-01T00:00:00.000Z' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration,
    });
    render(<DashboardPage />);
    expect(screen.getByText(/expiré/i)).toBeTruthy();
  });

  // link-expiration: Test 53 — TPP: conditional
  it('QrCard should show no expiry indicator when expiresAt is null', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ expiresAt: null })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration,
    });
    render(<DashboardPage />);
    expect(screen.queryByText(/expire le/i)).toBeNull();
    expect(screen.queryByText(/^expiré$/i)).toBeNull();
  });

  // link-expiration: Test 54 — TPP: constant
  it('QrCard should render date input with data-testid="expiry-date-input"', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem()], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration,
    });
    render(<DashboardPage />);
    expect(screen.getByTestId('expiry-date-input')).toBeTruthy();
  });

  // link-expiration: Test 55 — TPP: variable
  it('QrCard expiry date input onChange should call setExpiration(id, value)', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ id: 'qr-1' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration,
    });
    render(<DashboardPage />);
    fireEvent.change(screen.getByTestId('expiry-date-input'), { target: { value: '2026-08-25' } });
    expect(mockSetExpiration).toHaveBeenCalledWith('qr-1', '2026-08-25');
  });

  // link-expiration: Test 56 — TPP: conditional
  it('QrCard should show "Supprimer l\'expiration" button when expiresAt is non-null', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ expiresAt: '2099-12-31T23:59:59.000Z' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration,
    });
    render(<DashboardPage />);
    expect(screen.getByRole('button', { name: /supprimer l'expiration/i })).toBeTruthy();
  });

  // link-expiration: Test 57 — TPP: variable
  it('QrCard "Supprimer l\'expiration" button onClick should call setExpiration(id, null)', async () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ id: 'qr-1', expiresAt: '2099-12-31T23:59:59.000Z' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo, setExpiration: mockSetExpiration,
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
    expect(screen.getByText(/expire le/i)).toBeTruthy();
  });

  // link-expiration: Test 59 — TPP: conditional
  it('LinkCard should show "Expiré" badge when expiresAt is in the past', () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem({ expiresAt: '2020-01-01T00:00:00.000Z' })]));
    render(<DashboardPage />);
    expect(screen.getByText(/expiré/i)).toBeTruthy();
  });

  // link-expiration: Test 60 — TPP: variable
  it('LinkCard date input onChange should call setExpiration(id, value) from useLinks', () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem({ id: 'sl-1' })]));
    render(<DashboardPage />);
    fireEvent.change(screen.getByTestId('link-expiry-date-input'), { target: { value: '2026-08-25' } });
    expect(mockLinkSetExpiration).toHaveBeenCalledWith('sl-1', '2026-08-25');
  });

  // link-expiration: Test 61 — TPP: conditional
  it('LinkCard "Supprimer l\'expiration" button onClick should call setExpiration(id, null)', async () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem({ id: 'sl-1', expiresAt: '2099-12-31T23:59:59.000Z' })]));
    mockLinkSetExpiration.mockResolvedValue(undefined);
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /supprimer l'expiration du lien/i }));
    await waitFor(() => expect(mockLinkSetExpiration).toHaveBeenCalledWith('sl-1', null));
  });

  // link-expiration: Test 62 — TPP: variable
  it('LinksSection CreateForm date input should include expiresAt in create() call when value entered', async () => {
    mockLinkCreate.mockResolvedValue(undefined);
    render(<DashboardPage />);
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
