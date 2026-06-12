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

  submitApplication: (data: Partial<ApplicationData>) =>
    apiClient.post<{ success: boolean; referenceId: string; message: string }>(
      '/api/application/submit', {
        mobile: data.mobile,
        fullName: data.fullName,
        employmentType: data.employmentType,
        monthlyIncome: data.monthlyIncome,
        employer: data.employer,
        experience: data.experience,
        loanAmount: data.loanAmount,
        loanPurpose: data.loanPurpose,
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
