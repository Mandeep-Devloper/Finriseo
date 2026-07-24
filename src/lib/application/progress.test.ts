import { describe, it, expect } from 'vitest';
import {
  STEPS,
  computeProgressPct,
  estRemainingMinutes,
  motivationalMessage,
  routeForStep,
} from './progress';

describe('progress util', () => {
  it('has the six funnel steps in order', () => {
    expect(STEPS.map((s) => s.key)).toEqual([
      'otp_verified', 'basic_details', 'employment', 'pan_verified', 'offers', 'submitted',
    ]);
  });

  it('computes 0% for no completed steps', () => {
    expect(computeProgressPct([])).toBe(0);
  });

  it('computes rounded percentage from completed steps', () => {
    // 3 of 6 completed -> 50
    expect(computeProgressPct(['otp_verified', 'basic_details', 'employment'])).toBe(50);
  });

  it('ignores unknown/duplicate step keys when computing percent', () => {
    expect(computeProgressPct(['otp_verified', 'otp_verified', 'bogus'])).toBe(17);
  });

  it('caps at 100%', () => {
    expect(computeProgressPct(STEPS.map((s) => s.key))).toBe(100);
  });

  it('estimates fewer remaining minutes further along', () => {
    const early = estRemainingMinutes('basic_details');
    const late = estRemainingMinutes('offers');
    expect(early).toBeGreaterThan(late);
    expect(late).toBeGreaterThanOrEqual(0);
  });

  it('returns a friendly message keyed to progress', () => {
    expect(motivationalMessage(10)).toMatch(/./);
    expect(motivationalMessage(90)).toMatch(/almost/i);
  });

  it('maps a step key to its route', () => {
    expect(routeForStep('employment')).toBe('/apply/pan');
    expect(routeForStep('otp_verified')).toBe('/apply/basic-details');
  });
});
