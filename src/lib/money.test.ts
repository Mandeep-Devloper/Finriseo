import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { toNumber, toNullableNumber } from '@/lib/money';

// The money boundary must turn Prisma Decimal (and numeric strings) into exact JS
// numbers, and never surface NaN to callers.
describe('toNumber', () => {
  it('converts a Prisma Decimal to a number', () => {
    expect(toNumber(new Prisma.Decimal('10.49'))).toBe(10.49);
    expect(toNumber(new Prisma.Decimal('250000.00'))).toBe(250000);
  });

  it('passes numbers through', () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(0)).toBe(0);
  });

  it('parses numeric strings (as $queryRaw may return NUMERIC)', () => {
    expect(toNumber('1234.5')).toBe(1234.5);
  });

  it('returns the fallback for null/undefined/NaN', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber('not-a-number')).toBe(0);
    expect(toNumber(null, 99)).toBe(99);
  });
});

describe('toNullableNumber', () => {
  it('preserves null for optional columns', () => {
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber(undefined)).toBeNull();
  });

  it('converts present Decimals/numbers', () => {
    expect(toNullableNumber(new Prisma.Decimal('7.5'))).toBe(7.5);
    expect(toNullableNumber(0)).toBe(0);
  });

  it('returns null (not NaN) for junk', () => {
    expect(toNullableNumber('xyz')).toBeNull();
  });
});
