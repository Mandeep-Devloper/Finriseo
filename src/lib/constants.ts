// Versioned borrower consent. Stored on each Application (consentVersion) so we
// can prove WHICH Terms/Privacy revision a borrower agreed to. Bump this whenever
// the published Terms & Conditions / Privacy Policy text materially changes.
// TODO(legal): keep this value in lockstep with the published policy version —
// the wording and effective date are a legal/business decision, not code.
export const CONSENT_VERSION = '2026-07-04';

// Single source of truth for the user-facing "loans up to X" claim. Before this
// existed the site showed FOUR different ceilings at once (₹5L in the apply side
// panel, ₹10L on the hero, ₹50L on the apply step, ₹1Cr in validation copy) —
// which reads as untrustworthy in a financial product. ₹10,00,000 was chosen
// because the hero and the EMI calculator bounds already said it.
// TODO(business): confirm the real marketed ceiling and change it HERE only.
// (The server-side validation max in validations.ts is a deliberately generous
// upper bound, not marketing copy.)
export const MAX_LOAN_DISPLAY = '₹10,00,000';

export const COMPANY = {
  name: 'Finriseo',
  legalName: 'UpAndAlone Fintech Pvt. Ltd.',
  tagline: 'Compare. Apply. Get Loan.',
  description: "India's trusted loan comparison platform.",
  cin: 'U74999MH2024PTC000000',
  dsaRegistration: 'DSA/MH/2024/001234',
  email: 'support@finriseo.com',
  legalEmail: 'legal@finriseo.com',
  dpoEmail: 'dpo@finriseo.com',
  grievanceEmail: 'grievance@finriseo.com',
  phone: '1800-123-456',
  phoneHref: 'tel:+911800123456',
  workingHours: 'Monday - Saturday, 9:00 AM - 7:00 PM IST',
  address: {
    line1: '301, FinServe Tower, BKC',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400051',
    country: 'India',
    get full() { return `${this.line1}, ${this.city}, ${this.state} - ${this.pincode}`; },
  },
  grievanceOfficer: {
    name: 'Rajesh Mehta',
    email: 'grievance@finriseo.com',
    phone: '+91-22-4000-1234',
  },
  social: {
    linkedin: 'https://linkedin.com/company/finriseo',
    twitter: 'https://twitter.com/finriseo',
    website: 'https://finriseo.com',
  },
  stats: {
    customers: '2,00,000+',
    customersShort: '2L+',
    disbursed: '₹500 Cr+',
    partners: '50+',
    rating: '4.8',
  },
} as const;
