// Client-safe option sets for lender management. EMPLOYMENT_TYPES MUST match the
// exact values the apply funnel stores (src/app/(apply)/apply/employment) so that
// lender.employmentTypes filtering in the offers engine actually lines up.
export const EMPLOYMENT_TYPES = ['Salaried', 'Self Employed'] as const;

// Loan products Finriseo markets (display / optional filtering on lenders).
export const LOAN_TYPES = [
  'Personal',
  'Business',
  'Education',
  'Home',
  'Medical',
  'Pocket',
] as const;
