import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma, type Lender } from '@prisma/client';
import { db } from '@/lib/db';
import {
  getEligibleLenders,
  buildOffers,
  resolveSubmission,
  type EligibleLender,
} from '@/lib/services/eligibility';

// The eligibility engine's DB access is a single findMany; everything under
// test is the filtering/clamping/mapping logic on top of it.
vi.mock('@/lib/db', () => ({
  db: { lender: { findMany: vi.fn() } },
}));

const findMany = vi.mocked(db.lender.findMany);

let nextId = 1;
// Fixtures are the NUMERIC domain shape (EligibleLender) the engine emits after
// mapping Prisma's Decimal columns — so getEligibleLenders results toEqual them.
function makeLender(overrides: Partial<EligibleLender> = {}): EligibleLender {
  return {
    id: nextId++,
    name: 'Lender',
    interestRate: 12,
    tenureMonths: 24,
    processingFee: '1%',
    color: '#22c55e',
    minIncome: 0,
    maxMultiplier: 10,
    minAmount: null,
    maxAmount: null,
    employmentTypes: [],
    priority: 0,
    ...overrides,
  };
}

// The real query returns Prisma rows (Decimal columns); the engine maps them to
// numeric domain lenders. Feeding numeric fixtures through the mock is equivalent
// (toNumber() is identity on numbers) and keeps fixtures readable.
function mockLenders(lenders: EligibleLender[]) {
  findMany.mockResolvedValue(lenders as unknown as Lender[]);
}

beforeEach(() => {
  findMany.mockReset();
  nextId = 1;
});

describe('getEligibleLenders', () => {
  it('queries only active lenders whose income floor the borrower meets', async () => {
    findMany.mockResolvedValue([]);
    await getEligibleLenders({ monthlyIncome: 40000 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true, minIncome: { lte: 40000 } },
      })
    );
  });

  it('treats an empty employmentTypes list as "any employment"', async () => {
    const anyEmployment = makeLender({ employmentTypes: [] });
    mockLenders([anyEmployment]);
    const result = await getEligibleLenders({
      monthlyIncome: 40000,
      employmentType: 'Self Employed',
    });
    expect(result).toEqual([anyEmployment]);
  });

  it('drops restricted lenders when the borrower type is not listed or unknown', async () => {
    const salariedOnly = makeLender({ employmentTypes: ['Salaried'] });
    mockLenders([salariedOnly]);

    expect(
      await getEligibleLenders({ monthlyIncome: 40000, employmentType: 'Self Employed' })
    ).toEqual([]);
    expect(await getEligibleLenders({ monthlyIncome: 40000 })).toEqual([]);
    expect(
      await getEligibleLenders({ monthlyIncome: 40000, employmentType: 'Salaried' })
    ).toEqual([salariedOnly]);
  });

  it('drops lenders whose minAmount floor exceeds the requested amount', async () => {
    const bigTicket = makeLender({ minAmount: 500000 });
    mockLenders([bigTicket]);

    expect(await getEligibleLenders({ monthlyIncome: 40000, loanAmount: 100000 })).toEqual([]);
    expect(await getEligibleLenders({ monthlyIncome: 40000, loanAmount: 500000 })).toEqual([bigTicket]);
    // No requested amount → minAmount cannot disqualify.
    expect(await getEligibleLenders({ monthlyIncome: 40000 })).toEqual([bigTicket]);
  });

  it('maps Prisma Decimal columns to plain numbers at the DB boundary', async () => {
    // Feed a row exactly as Prisma returns it (Decimal money/rate columns) and
    // confirm the engine emits numbers downstream code can do arithmetic on.
    const dbRow = {
      id: 7,
      name: 'Decimal Bank',
      interestRate: new Prisma.Decimal('10.490'),
      tenureMonths: 36,
      processingFee: '1.5%',
      color: '#0369a1',
      minIncome: new Prisma.Decimal('25000.00'),
      maxMultiplier: new Prisma.Decimal('8.000'),
      minAmount: new Prisma.Decimal('50000.00'),
      maxAmount: null,
      employmentTypes: [],
      priority: 5,
    } as unknown as Lender;
    findMany.mockResolvedValue([dbRow]);

    const [lender] = await getEligibleLenders({ monthlyIncome: 40000, loanAmount: 100000 });
    expect(lender.interestRate).toBe(10.49);
    expect(lender.minIncome).toBe(25000);
    expect(lender.maxMultiplier).toBe(8);
    expect(lender.minAmount).toBe(50000);
    expect(typeof lender.interestRate).toBe('number');
  });
});

describe('buildOffers', () => {
  it('caps the offered amount at income × maxMultiplier', () => {
    const [offer] = buildOffers([makeLender({ maxMultiplier: 5 })], 1000000, 50000);
    expect(offer.amount).toBe(250000);
  });

  it('also caps at the lender absolute maxAmount when set', () => {
    const [offer] = buildOffers([makeLender({ maxMultiplier: 10, maxAmount: 300000 })], 1000000, 50000);
    expect(offer.amount).toBe(300000);
  });

  it('never offers more than requested', () => {
    const [offer] = buildOffers([makeLender({ maxMultiplier: 10 })], 100000, 50000);
    expect(offer.amount).toBe(100000);
  });

  it('rounds the EMI to whole rupees', () => {
    const [offer] = buildOffers(
      [makeLender({ interestRate: 12, tenureMonths: 12 })],
      100000,
      50000
    );
    expect(offer.emi).toBe(8885); // 8884.88 rounded
    expect(Number.isInteger(offer.emi)).toBe(true);
  });
});

describe('resolveSubmission', () => {
  it('rejects a selectedOfferId outside the eligible set (tampering)', async () => {
    mockLenders([makeLender({ id: 1 })]);
    const result = await resolveSubmission({
      loanAmount: 200000,
      monthlyIncome: 50000,
      selectedOfferId: 999,
    });
    expect(result.ok).toBe(false);
  });

  it('clamps the loan amount to the selected lender ceiling', async () => {
    mockLenders([makeLender({ id: 1, maxMultiplier: 4 })]);
    const result = await resolveSubmission({
      loanAmount: 900000,
      monthlyIncome: 50000,
      selectedOfferId: 1,
    });
    expect(result).toEqual({ ok: true, loanAmount: 200000, selectedOfferId: 1 });
  });

  it('uses the best available ceiling when no offer was selected', async () => {
    mockLenders([
      makeLender({ id: 1, maxMultiplier: 4 }),
      makeLender({ id: 2, maxMultiplier: 8, maxAmount: 350000 }),
    ]);
    const result = await resolveSubmission({ loanAmount: 900000, monthlyIncome: 50000 });
    // Best ceiling = min(50000×8, 350000) = 350000 (beats lender 1's 200000).
    expect(result).toEqual({ ok: true, loanAmount: 350000, selectedOfferId: null });
  });

  it('keeps the requested amount when no lender qualifies (lead is still captured)', async () => {
    findMany.mockResolvedValue([]);
    const result = await resolveSubmission({ loanAmount: 300000, monthlyIncome: 5000 });
    expect(result).toEqual({ ok: true, loanAmount: 300000, selectedOfferId: null });
  });

  it('passes the borrower criteria through to eligibility', async () => {
    findMany.mockResolvedValue([]);
    await resolveSubmission({
      loanAmount: 300000,
      monthlyIncome: 60000,
      employmentType: 'Salaried',
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true, minIncome: { lte: 60000 } } })
    );
  });
});
