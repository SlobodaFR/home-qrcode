export interface WifiFields {
  ssid: string;
  security: 'WPA' | 'WEP' | 'nopass';
  password?: string;
}

export interface EmailFields {
  to: string;
  subject?: string;
  body?: string;
}

export interface VcardFields {
  name: string;
  phone?: string;
  email?: string;
  org?: string;
}

function escapeWifi(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/"/g, '\\"');
}

export function encodeWifi(fields: WifiFields): string {
  const ssid = escapeWifi(fields.ssid);
  const pass = fields.security === 'nopass' ? '' : escapeWifi(fields.password ?? '');
  return `WIFI:T:${fields.security};S:${ssid};P:${pass};;`;
}

export function encodeEmail(fields: EmailFields): string {
  const parts: string[] = [];
  if (fields.subject !== undefined) parts.push(`subject=${encodeURIComponent(fields.subject)}`);
  if (fields.body !== undefined) parts.push(`body=${encodeURIComponent(fields.body)}`);
  return parts.length ? `MAILTO:${fields.to}?${parts.join('&')}` : `MAILTO:${fields.to}`;
}

export function encodeVcard(fields: VcardFields): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${fields.name}`];
  if (fields.phone !== undefined) lines.push(`TEL:${fields.phone}`);
  if (fields.email !== undefined) lines.push(`EMAIL:${fields.email}`);
  if (fields.org !== undefined) lines.push(`ORG:${fields.org}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}
