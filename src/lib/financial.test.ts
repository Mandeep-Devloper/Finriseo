import { describe, it, expect } from 'vitest';
import { calculateEMI, formatINR, generateReferenceId } from '@/lib/financial';
import { statusParamSchema } from '@/lib/validations';

describe('calculateEMI', () => {
  it('computes the standard EMI formula', () => {
    // ₹1,00,000 @ 12% p.a. over 12 months → ₹8,884.88 (standard amortization).
    expect(calculateEMI(100000, 12, 12)).toBeCloseTo(8884.88, 2);
  });

  it('handles a zero interest rate as simple division', () => {
    expect(calculateEMI(120000, 0, 12)).toBe(10000);
  });

  it('returns 0 for non-positive principal or tenure', () => {
    expect(calculateEMI(0, 12, 12)).toBe(0);
    expect(calculateEMI(-500, 12, 12)).toBe(0);
    expect(calculateEMI(100000, 12, 0)).toBe(0);
  });

  it('grows with the rate for the same principal and tenure', () => {
    const low = calculateEMI(500000, 10, 36);
    const high = calculateEMI(500000, 18, 36);
    expect(high).toBeGreaterThan(low);
  });
});

describe('formatINR', () => {
  it('uses Indian digit grouping', () => {
    expect(formatINR(100000)).toContain('1,00,000');
    expect(formatINR(10000000)).toContain('1,00,00,000');
  });

  it('rounds to whole rupees', () => {
    expect(formatINR(999.6)).toContain('1,000');
    expect(formatINR(999.6)).not.toContain('.');
  });
});

describe('generateReferenceId', () => {
  it('produces FIN + 9 uppercase alphanumerics', () => {
    expect(generateReferenceId()).toMatch(/^FIN[A-Z0-9]{9}$/);
  });

  it('matches the status route param schema', () => {
    const parsed = statusParamSchema.safeParse({ referenceId: generateReferenceId() });
    expect(parsed.success).toBe(true);
  });

  it('does not collide across many draws', () => {
    const ids = new Set(Array.from({ length: 500 }, generateReferenceId));
    expect(ids.size).toBe(500);
  });
});
