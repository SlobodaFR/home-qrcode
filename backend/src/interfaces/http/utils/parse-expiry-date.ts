export function parseExpiryDate(s: string): Date {
  return new Date(`${s}T23:59:59.000Z`);
}
