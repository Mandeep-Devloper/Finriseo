import type { Metadata } from 'next';
import ProductPage from '@/components/sections/ProductPage/ProductPage';

export const metadata: Metadata = {
  title: 'Education Loan for India & Abroad | Finriseo',
  description: 'Education loans up to ₹40 lakh for studies in India and abroad. Cover tuition, hostel, books, and more.',
};

export default function EducationLoanPage() {
  return (
    <ProductPage
      title="Education Loan upto ₹1,00,00,000"
      subtitle="Fund your higher education in India or abroad. Cover tuition, hostel, books, and living expenses — all in one loan."
      amount="₹40,00,000"
      rate="From 8.5% p.a."
      tenure="Up to 15 years"
      approval="24 hours"
      features={[
        'Covers tuition, hostel, books, laptop, travel',
        'Moratorium period during study + 6 months',
        'Repayment begins after course completion',
        'Covers India and abroad — 40+ countries',
        'Scholarship linked interest discount',
        'Tax benefit under Section 80E',
        'No collateral up to ₹7.5 lakh',
        'Competitive rates starting 8.5% p.a.',
        'Part-time employment income considered',
      ]}
      eligibility={[
        'Indian student, age 18 to 35 years',
        'Admission confirmed at recognised institution',
        'Co-applicant (parent/guardian) required',
        'Co-applicant CIBIL score 650 or above',
        'Recognised UG, PG, or professional course',
        'Institution in approved list of lender',
      ]}
      documents={[
        'PAN and Aadhaar of student and co-applicant',
        'Admission letter from institution',
        'Fee structure from institution',
        'Mark sheets of last qualifying exam',
        'Co-applicant income proof (salary/ITR)',
        'Co-applicant bank statement (6 months)',
      ]}
      faqs={[
        { q: 'When do I start repaying the loan?', a: 'Repayment starts 6 months after course completion or 12 months after the first disbursement — whichever comes first. During this moratorium, only simple interest is charged.' },
        { q: 'Can I get a loan without collateral?', a: 'Yes, loans up to ₹7.5 lakh are typically collateral-free. Above that amount, you may need property or fixed deposit as security.' },
        { q: 'Does the loan cover living expenses?', a: 'Yes. Most education loans cover tuition fees, examination fees, hostel charges, laptop, books, travel expenses, and other study-related costs.' },
        { q: 'What tax benefit do I get?', a: 'Interest paid on education loans is fully deductible under Section 80E of the Income Tax Act for up to 8 years from the year repayment begins.' },
        { q: 'Can I apply for foreign universities?', a: 'Yes. Our partner lenders fund education at recognised universities in 40+ countries including the USA, UK, Canada, Australia, and Germany.' },
      ]}
    />
  );
}
