export interface ApplicationData {
  // Step 1: Basic Info + OTP
  mobile: string;
  fullName: string;
  otpVerified: boolean;
  // Step 2: Basic Details
  loanAmount: number | string;
  email: string;
  pinCode: string;
  // Step 3: Employment
  employmentType: string;
  monthlyIncome: number | string;
  salaryMode: string;
  // Step 4: PAN
  panNumber: string;
  // Legacy (kept optional for backward compat)
  employer?: string;
  experience?: string;
  loanPurpose?: string;
  // Results
  selectedOffer: LoanOffer | null;
  referenceId: string;
  // True only once the final submit call has actually succeeded — distinct
  // from referenceId existing, since referenceId is now set as soon as OTP
  // is verified (draft application).
  submitted: boolean;
}

export interface LoanOffer {
  id: number;
  lender: string;
  rate: number;
  tenure: number;
  fee: string;
  color: string;
  emi: number;
  rateDisplay: string;
  tenureDisplay: string;
}

export type ApplyStep = 'basic' | 'basic-details' | 'employment' | 'pan' | 'offers' | 'success';
