import type { Metadata } from 'next';
import ProductPage from '@/components/sections/ProductPage/ProductPage';

export const metadata: Metadata = {
  title: 'Business Loan for SMEs | Quick Approval | Finriseo',
  description: 'Business loans for SMEs and self-employed from verified NBFCs. Flexible, collateral-free, same-day approval.',
};

export default function BusinessLoanPage() {
  return (
    <ProductPage
      title="Business Loan upto ₹50,00,000"
      subtitle="Grow your business with collateral-free loans from verified NBFCs. Flexible repayment, minimal documentation."
      amount="₹25,00,000"
      rate="From 12% p.a."
      tenure="6 – 84 months"
      approval="Same day"
      features={[
        'Loan amount from ₹50,000 to ₹25,00,000',
        'No collateral required',
        'Flexible tenure up to 84 months',
        'Working capital and term loans available',
        'Overdraft facility for eligible businesses',
        'GST-registered businesses get better rates',
        'Loan against business receivables',
        'Dedicated relationship manager',
        'Loan renewal available before full repayment',
      ]}
      eligibility={[
        'Indian resident, age 21 to 65 years',
        'Business operational for minimum 1 year',
        'Annual business turnover ₹10 lakh or above',
        'CIBIL score 650 or above',
        'Sole proprietor, partnership, or Pvt Ltd',
        'Valid GST registration preferred',
      ]}
      documents={[
        'PAN Card of business and owner',
        'Aadhaar Card of owner',
        'Business registration certificate',
        'Last 2 years ITR with computation',
        'Last 12 months bank statement',
        'GST returns (last 6 months)',
      ]}
      faqs={[
        { q: 'Do I need collateral for a business loan?', a: 'No. Our partner NBFCs offer collateral-free business loans up to ₹25 lakh for eligible borrowers with good credit history.' },
        { q: 'What types of businesses qualify?', a: 'Sole proprietors, partnership firms, and private limited companies can apply. Freelancers and self-employed professionals are also eligible.' },
        { q: 'How is loan amount calculated?', a: 'Loan amount is typically based on your average monthly business turnover, profitability, existing liabilities, and credit score.' },
        { q: 'Can I get a loan for a startup?', a: 'Most lenders require a business vintage of at least 1 year. For very new businesses, consider our Pocket Loan or Personal Loan as alternatives.' },
        { q: 'Is GST registration mandatory?', a: 'Not mandatory, but GST-registered businesses typically qualify for higher amounts and better interest rates from our partner lenders.' },
      ]}
    />
  );
}
