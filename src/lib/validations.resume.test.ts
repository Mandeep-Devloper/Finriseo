import { describe, it, expect } from 'vitest';
import { applicationPatchSchema } from './validations';

describe('applicationPatchSchema resume fields', () => {
  it('accepts resume fields', () => {
    const r = applicationPatchSchema.safeParse({
      currentStep: 'employment',
      currentRoute: '/apply/pan',
      progressPct: 50,
      completedSteps: ['otp_verified', 'basic_details', 'employment'],
      draftData: { loanAmount: 200000, email: 'a@b.com' },
    });
    expect(r.success).toBe(true);
  });

  it('rejects a progressPct out of range', () => {
    expect(applicationPatchSchema.safeParse({ progressPct: 250 }).success).toBe(false);
  });

  it('still accepts a bare field update', () => {
    expect(applicationPatchSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });
});
