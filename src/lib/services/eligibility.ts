// Single source of truth for loan eligibility + offer computation, shared by
// POST /api/application/offers (to display offers) and POST /api/application/submit
// (to re-validate the figures the client posts). Keeping both on the same logic
// stops the client-supplied loanAmount / selectedOfferId from being trusted as
// authoritative: the server always re-derives them from the live Lender table.
import { calculateEMI } from '@/lib/financial';
import { db } from '@/lib/db';

export type EligibleLender = Awaited<ReturnType<typeof getEligibleLenders>>[number];

export interface Offer {
  id: number;
  lender: string;
  rate: number;
  tenure: number;
  fee: string;
  color: string;
  amount: number;
  emi: number;
  rateDisplay: string;
  tenureDisplay: string;
}

export interface EligibilityCriteria {
  monthlyIncome: number;
  /** Borrower's employment type — used to honour each lender's employmentTypes. */
  employmentType?: string;
  /** Requested loan amount — used to honour each lender's absolute minAmount. */
  loanAmount?: number;
}

/**
 * Active lenders the applicant qualifies for, best-priority first.
 *
 * Beyond the income floor, this honours the admin-managed lender eligibility:
 *  - employmentTypes: [] means "any"; otherwise the borrower's employmentType
 *    must be listed (and an unknown borrower type can't match a restricted lender);
 *  - minAmount: if the borrower wants LESS than a lender's floor, that lender is
 *    not a fit and is dropped.
 * maxAmount is NOT a disqualifier — it caps the offered amount in buildOffers.
 * Existing lenders (employmentTypes []=default, minAmount null) are unaffected,
 * so borrower behaviour is unchanged until an admin sets these values.
 */
export async function getEligibleLenders(criteria: EligibilityCriteria) {
  const { monthlyIncome, employmentType, loanAmount } = criteria;
  const lenders = await db.lender.findMany({
    where: { active: true, minIncome: { lte: monthlyIncome } },
    orderBy: [{ priority: 'desc' }, { interestRate: 'asc' }],
  });

  return lenders.filter((l) => {
    if (l.employmentTypes.length > 0) {
      if (!employmentType || !l.employmentTypes.includes(employmentType)) return false;
    }
    if (loanAmount != null && l.minAmount != null && loanAmount < l.minAmount) return false;
    return true;
  });
}

/** Build display offers, capping each lender's amount at income × maxMultiplier. */
export function buildOffers(
  lenders: EligibleLender[],
  loanAmount: number,
  monthlyIncome: number
): Offer[] {
  return lenders.map((l) => {
    // Cap at income × maxMultiplier AND the lender's absolute maxAmount (if set).
    const eligible = Math.min(loanAmount, monthlyIncome * l.maxMultiplier, l.maxAmount ?? Infinity);
    return {
      id: l.id,
      lender: l.name,
      rate: l.interestRate,
      tenure: l.tenureMonths,
      fee: l.processingFee,
      color: l.color,
      amount: eligible,
      emi: Math.round(calculateEMI(eligible, l.interestRate, l.tenureMonths)),
      rateDisplay: `${l.interestRate}% p.a.`,
      tenureDisplay: `${l.tenureMonths} months`,
    };
  });
}

export type ResolvedSubmission =
  | { ok: true; loanAmount: number; selectedOfferId: number | null }
  | { ok: false; error: string };

/**
 * Re-derive the authoritative submission figures from the Lender table:
 *  - A selectedOfferId must belong to a lender the applicant actually qualifies
 *    for; otherwise it's been tampered with → reject.
 *  - loanAmount is clamped down to the eligible ceiling (income × maxMultiplier
 *    of the chosen lender, or the best available lender if none was chosen) so a
 *    client can't inflate the stored amount beyond what was ever offered.
 * When no lender qualifies (income below every minIncome) there is no ceiling to
 * enforce, so the requested amount is kept as-is for the lead.
 */
export async function resolveSubmission(input: {
  loanAmount: number;
  monthlyIncome: number;
  employmentType?: string;
  selectedOfferId?: number;
}): Promise<ResolvedSubmission> {
  // Re-derive eligibility with the SAME criteria the offers route used, so a
  // selectedOfferId is validated against the set the borrower could actually see.
  const lenders = await getEligibleLenders({
    monthlyIncome: input.monthlyIncome,
    employmentType: input.employmentType,
    loanAmount: input.loanAmount,
  });

  // Per-lender ceiling = income × maxMultiplier, capped by the absolute maxAmount.
  const lenderCeiling = (l: EligibleLender) =>
    Math.min(input.monthlyIncome * l.maxMultiplier, l.maxAmount ?? Infinity);

  let selected: EligibleLender | null = null;
  if (input.selectedOfferId != null) {
    selected = lenders.find((l) => l.id === input.selectedOfferId) ?? null;
    if (!selected) {
      return { ok: false, error: 'Selected offer is not available for your profile.' };
    }
  }

  const ceiling = selected
    ? lenderCeiling(selected)
    : lenders.length
      ? Math.max(...lenders.map(lenderCeiling))
      : input.loanAmount;

  return {
    ok: true,
    loanAmount: Math.min(input.loanAmount, ceiling),
    selectedOfferId: input.selectedOfferId ?? null,
  };
}
