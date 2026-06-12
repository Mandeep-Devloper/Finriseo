import type { Metadata } from 'next';
import ProductPage from '@/components/sections/ProductPage/ProductPage';

export const metadata: Metadata = {
  title: 'Personal Loan upto ₹5,00,000 | Instant Approval | Finriseo',
  description: 'Compare personal loan offers from verified NBFCs. Starting 10.49% p.a. Zero paperwork, 10 min approval.',
};

export default function PersonalLoanPage() {
  return (
    <ProductPage
      title="Personal Loan upto ₹5,00,000"
      subtitle="Compare offers from verified NBFCs. Get approved in 10 minutes with zero paperwork and competitive interest rates."
      amount="₹5,00,000"
      rate="From 10.49% p.a."
      tenure="3 – 60 months"
      approval="10 minutes"
      features={[
        'Loan amount from ₹10,000 to ₹5,00,000',
        'Interest rates starting at 10.49% p.a.',
        'Flexible tenure from 3 to 60 months',
        '100% digital process — no branch visit',
        'Same-day disbursal after approval',
        'No collateral or guarantor required',
        'Pre-approved offers for existing customers',
        'Part prepayment allowed after 6 months',
        'Compare offers from 50+ NBFCs',
      ]}
      eligibility={[
        'Indian resident, age 21 to 60 years',
        'Salaried or self-employed',
        'Minimum monthly income ₹15,000',
        'CIBIL score 650 or above',
        'Minimum 1 year of work experience',
        'Valid mobile number and email',
      ]}
      documents={[
        'PAN Card (mandatory)',
        'Aadhaar Card',
        'Last 3 months salary slips',
        'Last 6 months bank statement',
        'Address proof (Aadhaar / utility bill)',
        'Passport-size photograph',
      ]}
      faqs={[
        { q: 'What is the minimum CIBIL score required?', a: 'Most of our partner NBFCs require a minimum CIBIL score of 650. A higher score (750+) qualifies you for better rates and higher loan amounts.' },
        { q: 'How long does approval take?', a: 'Most applicants receive approval within 10 minutes of submitting their application. Disbursal typically happens on the same day.' },
        { q: 'Can I apply if I am self-employed?', a: 'Yes. Both salaried and self-employed individuals can apply. Self-employed applicants need to show business proof and last 2 years of ITR.' },
        { q: 'Are there any hidden charges?', a: 'No hidden charges. We display all processing fees, foreclosure charges, and other terms upfront before you accept any offer.' },
        { q: 'Can I prepay my loan early?', a: 'Yes. Most lenders allow part-prepayment after 6 months. Foreclosure charges vary by lender — typically 2-4% of outstanding principal.' },
      ]}
    />
  );
}
