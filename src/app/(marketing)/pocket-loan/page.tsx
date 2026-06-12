import type { Metadata } from 'next';
import ProductPage from '@/components/sections/ProductPage/ProductPage';

export const metadata: Metadata = {
  title: 'Pocket Loan upto ₹50,000 | Instant 5 Min | Finriseo',
  description: 'Quick small loans for everyday emergencies. Get up to ₹50,000 in just 5 minutes.',
};

export default function PocketLoanPage() {
  return (
    <ProductPage
      title="Pocket Loan upto ₹50,000"
      subtitle="Quick cash for everyday emergencies. No paperwork, no branch visit. Money in your account in 5 minutes."
      amount="₹50,000"
      rate="From 14% p.a."
      tenure="1 – 12 months"
      approval="5 minutes"
      features={[
        'Loan from ₹1,000 to ₹50,000',
        'Approval in under 5 minutes',
        'No collateral required',
        '100% digital — no documents needed',
        'Repay in flexible EMIs',
        'Available 24x7 including weekends',
        'Instant bank transfer after approval',
        'For salaried and self-employed',
        'Renew loan after 50% repayment',
      ]}
      eligibility={[
        'Indian resident, age 21 to 55 years',
        'Minimum monthly income ₹10,000',
        'Active bank account with UPI',
        'Valid Aadhaar and PAN card',
        'CIBIL score 600 or above',
        'Mobile number linked to Aadhaar',
      ]}
      documents={[
        'PAN Card',
        'Aadhaar Card',
        'Last 3 months bank statement',
        'Active UPI-linked bank account',
        'Selfie for KYC verification',
      ]}
      faqs={[
        { q: 'How fast do I get the money?', a: 'Once approved, the loan amount is transferred to your bank account within 5 minutes via IMPS.' },
        { q: 'Do I need any documents?', a: 'Just your Aadhaar and PAN. Everything else is verified digitally through your bank account.' },
        { q: 'Can I take multiple pocket loans?', a: 'You can apply for a new pocket loan once you have repaid at least 50% of your existing loan.' },
        { q: 'What if I miss an EMI?', a: 'A late payment fee applies. We recommend setting up auto-debit to avoid missing payments.' },
        { q: 'Is this available on weekends?', a: 'Yes. Applications are processed 24x7 including Sundays and public holidays.' },
      ]}
    />
  );
}
