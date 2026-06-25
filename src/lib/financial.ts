/**
 * Calculate EMI using standard formula:
 * EMI = P × r × (1 + r)^n / ((1 + r)^n - 1)
 */
export function calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / tenureMonths;
  return (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
}

/**
 * Format number as Indian Rupees (INR)
 */
export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

// Unambiguous uppercase alphanumeric alphabet for reference IDs.
const REF_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate a unique reference ID for loan applications.
 * Uses a CSPRNG (Web Crypto `getRandomValues`, available in both Node and the
 * browser — so this file stays safe to import from client components) instead
 * of `Math.random()` + a predictable timestamp. Produces `FIN` + 9 random
 * chars, which matches statusParamSchema's `^FIN[A-Z0-9]{6,12}$`.
 */
export function generateReferenceId(): string {
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  let id = '';
  for (const b of bytes) id += REF_ALPHABET[b % REF_ALPHABET.length];
  return `FIN${id}`;
}
