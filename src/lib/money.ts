// Money boundary helpers.
//
// Money and rates are stored as Prisma `Decimal` (Postgres NUMERIC) so that
// storage and DB-side sums are EXACT — no binary floating-point drift in
// disbursement/commission math. Prisma returns those columns as `Prisma.Decimal`
// (a decimal.js instance), which cannot be used with JS arithmetic operators.
//
// This module is the single, client-safe boundary that converts between the
// Decimal representation (DB) and plain `number` (domain logic + JSON responses):
//   - reads  → toNumber() / toNullableNumber()  (Decimal → number)
//   - writes → pass a plain number; Prisma coerces number → Decimal on its own.
//
// Keep JS-side money math minimal: exactness that matters (commission, disbursed
// totals) is computed in SQL over NUMERIC columns. EMI is intentionally a float
// (Math.pow) and shown as an indicative figure.
//
// `import type` keeps this file free of any runtime `@prisma/client` value, so it
// stays safe to import from client components (the type is erased at build).
import type { Prisma } from '@prisma/client';

/** Anything that can carry a numeric money/rate value across the DB boundary. */
export type Decimalish = Prisma.Decimal | number | string | null | undefined;

/**
 * Convert a Prisma Decimal / number / numeric string to a JS number.
 * Returns `fallback` (default 0) for null/undefined/NaN — never throws, never
 * returns NaN, so callers can rely on getting a usable number.
 */
export function toNumber(value: Decimalish, fallback = 0): number {
  if (value == null) return fallback;
  const n = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(n) ? n : fallback;
}

/** Like toNumber() but preserves null/undefined as null (for optional columns). */
export function toNullableNumber(value: Decimalish): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}
