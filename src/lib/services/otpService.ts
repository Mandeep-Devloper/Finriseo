import { apiClient } from './apiClient';

export const otpService = {
  sendOtp: (mobile: string) =>
    apiClient.post<{ success: boolean; message: string; expiresInSeconds: number; _devOtp?: string }>(
      '/api/otp/send', { mobile }
    ),

  verifyOtp: (mobile: string, otp: string) =>
    apiClient.post<{ success: boolean; verified: boolean }>(
      '/api/otp/verify', { mobile, otp }
    ),

  resendOtp: (mobile: string) =>
    apiClient.post<{ success: boolean; message: string }>(
      '/api/otp/resend', { mobile }
    ),
};
