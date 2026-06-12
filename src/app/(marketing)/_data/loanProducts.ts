export interface Feature {
  title: string;
  description: string;
  iconName: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface LoanProductData {
  title: string;
  subtitle: string;
  features: Feature[];
  eligibility: string[];
  documentsRequired: string[];
  faqs: FAQ[];
}

export const personalLoanData: LoanProductData = {
  title: 'Personal Loan',
  subtitle: 'Get instant personal loans up to ₹50 Lakhs with minimal paperwork. Perfect for medical emergencies, weddings, or travel.',
  features: [
    { title: 'Zero Prepayment Charges', description: 'Pay off your loan early without any hidden penalties.', iconName: 'Percent' },
    { title: 'Instant Disbursal', description: 'Money in your bank account within 24 hours of approval.', iconName: 'Zap' },
    { title: 'No Collateral Required', description: 'Completely unsecured loans based on your credit profile.', iconName: 'ShieldCheck' },
    { title: 'Flexible Repayment', description: 'Choose tenures from 12 to 60 months based on your convenience.', iconName: 'Calendar' },
    { title: '100% Digital Process', description: 'From application to disbursal, everything is online.', iconName: 'Smartphone' },
    { title: 'Competitive Interest Rates', description: 'Rates starting from as low as 10.49% p.a.', iconName: 'TrendingDown' },
  ],
  eligibility: [
    'Must be an Indian citizen residing in India',
    'Age between 21 and 58 years',
    'Salaried employee with a minimum monthly income of ₹15,000',
    'Minimum CIBIL score of 650',
    'At least 6 months of work experience with current employer'
  ],
  documentsRequired: [
    'PAN Card (mandatory)',
    'Aadhaar Card or Passport (for KYC)',
    'Last 3 months salary slips',
    'Last 6 months bank statements showing salary credit'
  ],
  faqs: [
    { question: 'What is the maximum personal loan amount I can get?', answer: 'You can apply for a personal loan ranging from ₹10,000 up to ₹50 Lakhs, depending on your income, credit score, and repayment capacity.' },
    { question: 'How long does the approval process take?', answer: 'Our 100% digital process allows for instant in-principle approval. Final disbursal usually happens within 24 hours after document verification.' },
    { question: 'Can I foreclose my personal loan?', answer: 'Yes, you can foreclose your loan at any time. Depending on the lender, there are zero or minimal prepayment charges after the first few EMIs.' },
    { question: 'Does applying for a loan affect my CIBIL score?', answer: 'Checking your loan offers on Finriseo counts as a "soft inquiry" and does not impact your CIBIL score.' }
  ]
};

export const businessLoanData: LoanProductData = {
  title: 'Business Loan',
  subtitle: 'Scale your enterprise with flexible business loans up to ₹5 Crores. Collateral-free options available for MSMEs.',
  features: [
    { title: 'Collateral-free Options', description: 'Get up to ₹50 Lakhs without pledging any assets.', iconName: 'Unlock' },
    { title: 'High Loan Value', description: 'Secured loans available up to ₹5 Crores for major expansions.', iconName: 'TrendingUp' },
    { title: 'Custom Repayment Plans', description: 'Match your EMI schedule with your business cash flow.', iconName: 'RefreshCcw' },
    { title: 'Minimal Documentation', description: 'Fast processing based on GST returns and bank statements.', iconName: 'FileText' },
    { title: 'Dedicated Relationship Manager', description: 'Get personalized assistance throughout the loan lifecycle.', iconName: 'UserCheck' },
    { title: 'Quick Funding', description: 'Disbursals in 48-72 hours to keep your business moving.', iconName: 'Clock' },
  ],
  eligibility: [
    'Business must be operating for at least 2 years',
    'Minimum annual turnover of ₹40 Lakhs',
    'Business location and residence should be physically separate (preferred)',
    'Promoter age between 25 and 65 years',
    'Positive net worth and profitable for the last 2 consecutive years'
  ],
  documentsRequired: [
    'PAN Card of the company and promoters',
    'GST Registration Certificate & GST returns for 1 year',
    'Audited Financials (P&L and Balance Sheet) for last 2 years',
    'Last 12 months business bank statements'
  ],
  faqs: [
    { question: 'Do I need collateral for a business loan?', answer: 'We offer both unsecured (up to ₹50 Lakhs) and secured business loans. Unsecured loans do not require collateral.' },
    { question: 'Can a startup get a business loan?', answer: 'Most of our lending partners require a minimum business vintage of 2 years. We recommend checking specific startup schemes if you have less vintage.' },
    { question: 'What is the interest rate for business loans?', answer: 'Interest rates typically range from 14% to 24% p.a. for unsecured loans, depending on your business health and credit profile.' },
    { question: 'How is the business loan EMI calculated?', answer: 'EMI is calculated based on the principal amount, interest rate, and tenure. You can use our EMI calculator to estimate your monthly outflows.' }
  ]
};

export const educationLoanData: LoanProductData = {
  title: 'Education Loan',
  subtitle: 'Invest in your future with education loans up to ₹1 Crore. Comprehensive coverage for domestic and international studies.',
  features: [
    { title: '100% Financing', description: 'Covers tuition fees, accommodation, books, and travel.', iconName: 'Briefcase' },
    { title: 'Moratorium Period', description: 'Repayment starts 6-12 months after course completion.', iconName: 'GraduationCap' },
    { title: 'Tax Benefits', description: 'Claim deductions under Section 80E of the Income Tax Act.', iconName: 'FileBadge' },
    { title: 'No Margin Money', description: 'Zero margin money required for premier institutes.', iconName: 'Award' },
    { title: 'Fast Visa Approvals', description: 'Quick sanction letters to assist with student visa applications.', iconName: 'Plane' },
    { title: 'Long Repayment Tenure', description: 'Comfortably repay over a period of up to 15 years.', iconName: 'CalendarDays' },
  ],
  eligibility: [
    'Must be an Indian citizen',
    'Secured admission in a recognized university (India or abroad)',
    'Co-applicant (parent/guardian/spouse) with regular income source is mandatory',
    'Good academic record of the student',
    'Strong credit history of the co-applicant'
  ],
  documentsRequired: [
    'KYC documents of student and co-applicant',
    'Admission letter with fee schedule',
    'Academic marksheets (10th, 12th, and Degree)',
    'Income proof of co-applicant (Salary slips, ITR)',
    'Property documents if applying for a secured loan'
  ],
  faqs: [
    { question: 'Does the loan cover living expenses?', answer: 'Yes, our education loans cover up to 100% of costs including tuition, hostel, laptops, and travel expenses.' },
    { question: 'What is a moratorium period?', answer: 'It is a repayment holiday during your course duration plus an additional 6 to 12 months, allowing you time to secure a job before EMIs begin.' },
    { question: 'Is a co-applicant mandatory?', answer: 'Yes, for all education loans, a co-applicant (usually a parent or spouse) with a steady income source is required as a guarantor.' },
    { question: 'What are the benefits under Section 80E?', answer: 'Under Section 80E, the interest paid on an education loan is fully tax-deductible for up to 8 years, reducing the effective cost of your loan.' }
  ]
};
