import { describe, it, expect } from 'vitest';
import {
  step1Schema,
  applicationStartSchema,
  applicationSubmitSchema,
  statusParamSchema,
  adminApplicationPatchSchema,
  adminUserUpdateSchema,
  adminLenderCreateSchema,
  contactSchema,
} from '@/lib/validations';

describe('step1Schema (name + mobile + consent)', () => {
  const valid = { fullName: 'Asha Verma', mobile: '9876543210', consent: true };

  it('accepts a valid Indian mobile', () => {
    expect(step1Schema.safeParse(valid).success).toBe(true);
  });

  it('rejects mobiles that do not start 6-9 or are not 10 digits', () => {
    expect(step1Schema.safeParse({ ...valid, mobile: '5876543210' }).success).toBe(false);
    expect(step1Schema.safeParse({ ...valid, mobile: '987654321' }).success).toBe(false);
    expect(step1Schema.safeParse({ ...valid, mobile: '98765432100' }).success).toBe(false);
  });

  it('requires consent to be true', () => {
    expect(step1Schema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });
});

describe('applicationStartSchema (consent capture)', () => {
  const valid = { mobile: '9876543210', fullName: 'Asha Verma' };

  it('accepts a start without consent (backward compatible)', () => {
    expect(applicationStartSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts an explicit consent flag', () => {
    const parsed = applicationStartSchema.safeParse({ ...valid, consent: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.consent).toBe(true);
  });

  it('rejects a bad mobile or too-short name', () => {
    expect(applicationStartSchema.safeParse({ ...valid, mobile: '123' }).success).toBe(false);
    expect(applicationStartSchema.safeParse({ ...valid, fullName: 'A' }).success).toBe(false);
  });
});

describe('applicationSubmitSchema', () => {
  const valid = {
    mobile: '9876543210',
    fullName: 'Asha Verma',
    employmentType: 'Salaried',
    monthlyIncome: 50000,
    loanAmount: 200000,
  };

  it('accepts the minimal valid payload', () => {
    expect(applicationSubmitSchema.safeParse(valid).success).toBe(true);
  });

  it('coerces numeric strings for amounts', () => {
    const parsed = applicationSubmitSchema.safeParse({
      ...valid,
      loanAmount: '200000',
      monthlyIncome: '50000',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.loanAmount).toBe(200000);
      expect(parsed.data.monthlyIncome).toBe(50000);
    }
  });

  it('rejects non-positive amounts', () => {
    expect(applicationSubmitSchema.safeParse({ ...valid, loanAmount: 0 }).success).toBe(false);
    expect(applicationSubmitSchema.safeParse({ ...valid, monthlyIncome: -1 }).success).toBe(false);
  });

  it('validates PAN format when present, allows it absent', () => {
    expect(applicationSubmitSchema.safeParse({ ...valid, panNumber: 'ABCDE1234F' }).success).toBe(true);
    expect(applicationSubmitSchema.safeParse({ ...valid, panNumber: 'abcde1234f' }).success).toBe(false);
    expect(applicationSubmitSchema.safeParse({ ...valid, panNumber: 'ABCDE1234' }).success).toBe(false);
  });
});

describe('statusParamSchema', () => {
  it('accepts generated-style reference ids', () => {
    expect(statusParamSchema.safeParse({ referenceId: 'FINA1B2C3D4E' }).success).toBe(true);
  });

  it('rejects lowercase, short, or unprefixed ids', () => {
    expect(statusParamSchema.safeParse({ referenceId: 'fina1b2c3d4e' }).success).toBe(false);
    expect(statusParamSchema.safeParse({ referenceId: 'FINAB' }).success).toBe(false);
    expect(statusParamSchema.safeParse({ referenceId: 'ABCDEFGHI123' }).success).toBe(false);
  });
});

describe('adminApplicationPatchSchema (op-discriminated)', () => {
  it('accepts a pipeline status change', () => {
    const parsed = adminApplicationPatchSchema.safeParse({ op: 'status', status: 'contacted' });
    expect(parsed.success).toBe(true);
  });

  it('rejects "draft" — admins cannot move a lead back to a pre-pipeline status', () => {
    expect(adminApplicationPatchSchema.safeParse({ op: 'status', status: 'draft' }).success).toBe(false);
  });

  it('accepts assign with null (unassign) and rejects empty-string ids', () => {
    expect(adminApplicationPatchSchema.safeParse({ op: 'assign', assignedToId: null }).success).toBe(true);
    expect(adminApplicationPatchSchema.safeParse({ op: 'assign', assignedToId: '' }).success).toBe(false);
  });

  it('coerces the disbursement date and requires a positive amount', () => {
    const parsed = adminApplicationPatchSchema.safeParse({
      op: 'disbursement',
      chosenLenderId: 3,
      disbursedAmount: '150000',
      disbursedAt: '2026-07-01',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.op === 'disbursement') {
      expect(parsed.data.disbursedAt).toBeInstanceOf(Date);
      expect(parsed.data.disbursedAmount).toBe(150000);
    }
    expect(
      adminApplicationPatchSchema.safeParse({
        op: 'disbursement',
        chosenLenderId: 3,
        disbursedAmount: -1,
        disbursedAt: '2026-07-01',
      }).success
    ).toBe(false);
  });
});

describe('adminUserUpdateSchema', () => {
  it('rejects an empty update', () => {
    expect(adminUserUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('accepts role-only or active-only updates', () => {
    expect(adminUserUpdateSchema.safeParse({ role: 'AGENT' }).success).toBe(true);
    expect(adminUserUpdateSchema.safeParse({ active: false }).success).toBe(true);
  });
});

describe('adminLenderCreateSchema', () => {
  const valid = {
    name: 'Acme Finance',
    interestRate: 12.5,
    tenureMonths: 24,
    processingFee: '1.5%',
    color: '#22c55e',
    minIncome: 20000,
    maxMultiplier: 10,
  };

  it('applies defaults for omitted optional fields', () => {
    const parsed = adminLenderCreateSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.employmentTypes).toEqual([]);
      expect(parsed.data.loanTypes).toEqual([]);
      expect(parsed.data.active).toBe(true);
      expect(parsed.data.priority).toBe(0);
    }
  });

  it('rejects out-of-range rates and bad colors', () => {
    expect(adminLenderCreateSchema.safeParse({ ...valid, interestRate: 150 }).success).toBe(false);
    expect(adminLenderCreateSchema.safeParse({ ...valid, color: 'not-a-color!' }).success).toBe(false);
  });
});

describe('contactSchema', () => {
  const valid = {
    name: 'Asha Verma',
    email: 'asha@example.com',
    phone: '9876543210',
    subject: 'Loan enquiry',
    message: 'I would like to know more about personal loan offers.',
  };

  it('accepts a valid message', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true);
  });

  it('enforces message length bounds', () => {
    expect(contactSchema.safeParse({ ...valid, message: 'too short' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, message: 'x'.repeat(501) }).success).toBe(false);
  });
});
