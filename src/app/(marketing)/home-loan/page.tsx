import type { Metadata } from 'next';
import ProductPage from '@/components/sections/ProductPage/ProductPage';

export const metadata: Metadata = {
  title: 'Home Loan upto ₹1 Crore | Best Rates | Finriseo',
  description: 'Compare home loan offers from verified NBFCs and banks. Starting 8.5% p.a. Quick approval.',
};

export default function HomeLoanPage() {
  return (
    <ProductPage
      title="Home Loan upto ₹1,00,00,000"
      subtitle="Finance your dream home with the best rates from India's top lenders. Compare offers and choose what works for you."
      amount="₹1,00,00,000"
      rate="From 8.5% p.a."
      tenure="Up to 30 years"
      approval="24 – 48 hours"
      features={[
        'Loan up to ₹1 crore from top lenders',
        'Tenure up to 30 years',
        'Balance transfer from existing lender',
        'Top-up loan available after 6 months',
        'Tax benefit under Section 80C and 24(b)',
        'Both ready-to-move and under-construction',
        'Fixed and floating rate options',
        'No prepayment penalty on floating rate',
        'PMAY subsidy for eligible applicants',
      ]}
      eligibility={[
        'Indian resident, age 21 to 65 years',
        'Salaried or self-employed with ITR',
        'Minimum monthly income ₹25,000',
        'CIBIL score 700 or above',
        'Property must be in an approved location',
        'Co-applicant recommended for higher amount',
      ]}
      documents={[
        'PAN and Aadhaar of all applicants',
        'Last 3 months salary slips',
        'Last 2 years ITR with computation',
        'Last 6 months bank statement',
        'Property documents and NOC',
        'Property valuation report',
      ]}
      faqs={[
        { q: 'What is the maximum tenure I can get?', a: 'Home loans are available for up to 30 years. However, the loan must be fully repaid before the oldest applicant turns 70.' },
        { q: 'Can I claim tax benefit on home loan?', a: 'Yes. Principal repayment is deductible under Section 80C (up to ₹1.5 lakh) and interest under Section 24(b) (up to ₹2 lakh per year).' },
        { q: 'What is a balance transfer?', a: 'If you have an existing home loan, you can transfer it to a new lender offering a lower interest rate through Finriseo.' },
        { q: 'Is PMAY subsidy available?', a: 'Yes. First-time home buyers from EWS, LIG, and MIG categories may be eligible for PMAY interest subsidy of up to ₹2.67 lakh.' },
        { q: 'What properties are eligible?', a: 'Ready-to-move flats, under-construction properties, independent houses, and plots (with construction) from RERA-registered developers are eligible.' },
      ]}
    />
  );
}
