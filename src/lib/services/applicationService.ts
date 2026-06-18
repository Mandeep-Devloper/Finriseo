import { apiClient } from './apiClient';
import type { ApplicationData, LoanOffer } from '@/types/application';

export const applicationService = {
  fetchOffers: (payload: {
    mobile: string;
    loanAmount: number;
    employmentType: string;
    monthlyIncome: number;
  }) => apiClient.post<{ success: boolean; offers: LoanOffer[]; disclaimer: string }>(
    '/api/application/offers', payload
  ),

  // Creates (or resumes) a draft Application row right after OTP verification,
  // so the lead is visible in the database from step 1.
  startApplication: (data: { mobile: string; fullName: string; referenceId?: string }) =>
    apiClient.post<{ success: boolean; referenceId: string }>(
      '/api/application/start', data
    ),

  // Saves whatever fields a given funnel step collected, against the draft
  // created by startApplication.
  updateApplication: (referenceId: string, data: Partial<ApplicationData> & { currentStep?: string }) =>
    apiClient.patch<{ success: boolean }>(
      `/api/application/${referenceId}`, data
    ),

  submitApplication: (data: Partial<ApplicationData>) =>
    apiClient.post<{ success: boolean; referenceId: string; message: string }>(
      '/api/application/submit', {
        referenceId: data.referenceId,
        mobile: data.mobile,
        fullName: data.fullName,
        email: data.email,
        pinCode: data.pinCode,
        employmentType: data.employmentType,
        monthlyIncome: data.monthlyIncome,
        salaryMode: data.salaryMode,
        employer: data.employer,
        experience: data.experience,
        loanAmount: data.loanAmount,
        loanPurpose: data.loanPurpose,
        panNumber: data.panNumber,
        selectedOfferId: data.selectedOffer?.id,
      }
    ),

  getStatus: (referenceId: string) =>
    apiClient.get<{ status: string; steps: unknown[] }>(
      `/api/application/status/${referenceId}`
    ),
};

export const contactService = {
  submit: (data: { name: string; email: string; phone: string; subject: string; message: string }) =>
    apiClient.post<{ success: boolean; message: string }>('/api/contact', data),
};
