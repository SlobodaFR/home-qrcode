import { encodeEmail, encodeVcard, encodeWifi } from './qr-content.encoder';

describe('encodeWifi', () => {
  // Test 1 — TPP: constant
  it('should return WIFI string with T:WPA for minimal WPA input', () => {
    expect(encodeWifi({ ssid: 'MyNet', security: 'WPA', password: 'secret' }))
      .toBe('WIFI:T:WPA;S:MyNet;P:secret;;');
  });

  // Test 2 — TPP: variable
  it('should interpolate ssid and password from fields', () => {
    expect(encodeWifi({ ssid: 'OfficeNet', security: 'WPA', password: 'p@ss123' }))
      .toBe('WIFI:T:WPA;S:OfficeNet;P:p@ss123;;');
  });

  // Test 3 — TPP: conditional
  it('should encode nopass with empty P segment', () => {
    expect(encodeWifi({ ssid: 'OpenNet', security: 'nopass' }))
      .toBe('WIFI:T:nopass;S:OpenNet;P:;;');
  });

  // Test 4 — TPP: conditional
  it('should ignore password when security is nopass', () => {
    expect(encodeWifi({ ssid: 'OpenNet', security: 'nopass', password: 'shouldBeIgnored' }))
      .toBe('WIFI:T:nopass;S:OpenNet;P:;;');
  });

  // Test 5 — TPP: conditional
  it('should use WEP in T segment for WEP security', () => {
    expect(encodeWifi({ ssid: 'OldNet', security: 'WEP', password: 'key123' }))
      .toBe('WIFI:T:WEP;S:OldNet;P:key123;;');
  });

  // Test 6 — TPP: collection
  it('should escape backslash in ssid', () => {
    expect(encodeWifi({ ssid: 'My\\Net', security: 'WPA', password: 'pass' }))
      .toBe('WIFI:T:WPA;S:My\\\\Net;P:pass;;');
  });

  // Test 7 — TPP: collection
  it('should escape semicolon in password', () => {
    expect(encodeWifi({ ssid: 'Net', security: 'WPA', password: 'pa;ss' }))
      .toBe('WIFI:T:WPA;S:Net;P:pa\\;ss;;');
  });

  // Test 8 — TPP: collection
  it('should escape comma in ssid', () => {
    expect(encodeWifi({ ssid: 'My,Net', security: 'WPA', password: 'pass' }))
      .toBe('WIFI:T:WPA;S:My\\,Net;P:pass;;');
  });

  // Test 9 — TPP: collection
  it('should escape double-quote in ssid', () => {
    expect(encodeWifi({ ssid: 'My"Net', security: 'WPA', password: 'pass' }))
      .toBe('WIFI:T:WPA;S:My\\"Net;P:pass;;');
  });
});

describe('encodeEmail', () => {
  // Test 10 — TPP: constant
  it('should return bare MAILTO:{to} when only to is given', () => {
    expect(encodeEmail({ to: 'user@example.com' })).toBe('MAILTO:user@example.com');
  });

  // Test 11 — TPP: conditional
  it('should append ?subject={subject} when subject is present', () => {
    expect(encodeEmail({ to: 'user@example.com', subject: 'Hello' }))
      .toBe('MAILTO:user@example.com?subject=Hello');
  });

  // Test 12 — TPP: conditional
  it('should append ?body={body} when body is present', () => {
    expect(encodeEmail({ to: 'user@example.com', body: 'Hi there' }))
      .toBe('MAILTO:user@example.com?body=Hi%20there');
  });

  // Test 13 — TPP: conditional
  it('should include both subject and body joined with &', () => {
    expect(encodeEmail({ to: 'user@example.com', subject: 'Hello', body: 'World' }))
      .toBe('MAILTO:user@example.com?subject=Hello&body=World');
  });
});

describe('encodeVcard', () => {
  // Test 14 — TPP: constant
  it('should return vCard 3.0 with only FN when only name given', () => {
    expect(encodeVcard({ name: 'Jane Doe' })).toBe(
      'BEGIN:VCARD\nVERSION:3.0\nFN:Jane Doe\nEND:VCARD',
    );
  });

  // Test 15 — TPP: conditional
  it('should include TEL line when phone present', () => {
    expect(encodeVcard({ name: 'Jane', phone: '+33612345678' })).toBe(
      'BEGIN:VCARD\nVERSION:3.0\nFN:Jane\nTEL:+33612345678\nEND:VCARD',
    );
  });

  // Test 16 — TPP: conditional
  it('should include EMAIL line when email present', () => {
    expect(encodeVcard({ name: 'Jane', email: 'jane@example.com' })).toBe(
      'BEGIN:VCARD\nVERSION:3.0\nFN:Jane\nEMAIL:jane@example.com\nEND:VCARD',
    );
  });

  // Test 17 — TPP: conditional
  it('should include ORG line when org present', () => {
    expect(encodeVcard({ name: 'Jane', org: 'Acme Corp' })).toBe(
      'BEGIN:VCARD\nVERSION:3.0\nFN:Jane\nORG:Acme Corp\nEND:VCARD',
    );
  });

  // Test 18 — TPP: conditional
  it('should omit all optional lines when no optional fields given', () => {
    const result = encodeVcard({ name: 'Bob' });
    expect(result).not.toContain('TEL');
    expect(result).not.toContain('EMAIL');
    expect(result).not.toContain('ORG');
  });
});
