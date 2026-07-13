// Small shared formatters for the admin panel (client-safe).
import { formatINR } from '@/lib/financial';
import { toNullableNumber, type Decimalish } from '@/lib/money';

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(d));
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
}

/** Format a money value (Prisma Decimal, number, or null) as INR, or '—'. */
export function fmtMoney(n: Decimalish): string {
  const num = toNullableNumber(n);
  if (num == null) return '—';
  return formatINR(num);
}
