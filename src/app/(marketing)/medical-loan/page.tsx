import type { Metadata } from 'next';
import ProductPage from '@/components/sections/ProductPage/ProductPage';

export const metadata: Metadata = {
  title: 'Medical Loan upto ₹10,00,000 | Emergency Funding | Finriseo',
  description: 'Get instant medical emergency loans up to ₹10 lakh. 15 minute approval for hospital, surgery, and treatment costs.',
};

export default function MedicalLoanPage() {
  return (
    <ProductPage
      title="Medical Loan upto ₹10,00,000"
      subtitle="Emergency medical funding when you need it most. Cover hospital bills, surgery, treatment, and recovery costs instantly."
      amount="₹10,00,000"
      rate="From 11% p.a."
      tenure="3 – 48 months"
      approval="15 minutes"
      features={[
        'Loan from ₹10,000 to ₹10,00,000',
        'Approval in 15 minutes',
        'Cover hospital, surgery, medicine costs',
        'Pre-approved for existing customers',
        'Direct payment to hospital available',
        'No collateral required',
        '100% digital application process',
        'EMI holiday for first 3 months available',
        'Available for planned and emergency treatment',
      ]}
      eligibility={[
        'Indian resident, age 21 to 60 years',
        'Salaried or self-employed',
        'Minimum monthly income ₹15,000',
        'CIBIL score 620 or above',
        'Valid hospital admission letter or quote',
        'Active bank account',
      ]}
      documents={[
        'PAN and Aadhaar Card',
        'Hospital admission letter or treatment estimate',
        'Last 3 months salary slips or ITR',
        'Last 3 months bank statement',
        'Doctor prescription (if applicable)',
      ]}
      faqs={[
        { q: 'Can I get the loan directly credited to the hospital?', a: 'Yes. For large medical procedures, we can arrange direct payment to the hospital on your behalf, subject to lender approval.' },
        { q: 'Is there an EMI holiday option?', a: 'Some partner lenders offer a moratorium of up to 3 months, where you only pay the interest and the EMI starts after the holiday period.' },
        { q: 'Can I apply for a family member treatment?', a: 'Yes. You can take a medical loan for the treatment of immediate family members including spouse, children, and parents.' },
        { q: 'How soon will I get the money?', a: 'In most cases, the loan is disbursed within 15-30 minutes of approval, directly to your bank account via IMPS.' },
        { q: 'What treatments are covered?', a: 'All medical treatments including surgery, cancer treatment, dental procedures, IVF, orthopaedic, and planned or emergency hospitalisation are covered.' },
      ]}
    />
  );
}
