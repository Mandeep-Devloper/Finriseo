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

/** Active lenders the given monthly income qualifies for, best-priority first. */
export function getEligibleLenders(monthlyIncome: number) {
  return db.lender.findMany({
    where: { active: true, minIncome: { lte: monthlyIncome } },
    orderBy: [{ priority: 'desc' }, { interestRate: 'asc' }],
  });
}

/** Build display offers, capping each lender's amount at income × maxMultiplier. */
export function buildOffers(
  lenders: EligibleLender[],
  loanAmount: number,
  monthlyIncome: number
): Offer[] {
  return lenders.map((l) => {
    const eligible = Math.min(loanAmount, monthlyIncome * l.maxMultiplier);
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
  selectedOfferId?: number;
}): Promise<ResolvedSubmission> {
  const lenders = await getEligibleLenders(input.monthlyIncome);

  let selected: EligibleLender | null = null;
  if (input.selectedOfferId != null) {
    selected = lenders.find((l) => l.id === input.selectedOfferId) ?? null;
    if (!selected) {
      return { ok: false, error: 'Selected offer is not available for your profile.' };
    }
  }

  const ceiling = selected
    ? input.monthlyIncome * selected.maxMultiplier
    : lenders.length
      ? Math.max(...lenders.map((l) => input.monthlyIncome * l.maxMultiplier))
      : input.loanAmount;

  return {
    ok: true,
    loanAmount: Math.min(input.loanAmount, ceiling),
    selectedOfferId: input.selectedOfferId ?? null,
  };
}
