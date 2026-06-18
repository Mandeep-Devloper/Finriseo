import { apiClient } from './apiClient';

export const otpService = {
  // OTP send + verify happens client-side via Firebase Phone Auth
  // (see src/lib/services/firebaseOtp.ts). This call hands the resulting
  // Firebase ID token to our server, which verifies it before we trust that
  // the mobile number was OTP-verified.
  verifyToken: (mobile: string, idToken: string) =>
    apiClient.post<{ success: boolean; verified: boolean }>(
      '/api/otp/verify', { mobile, idToken }
    ),
};
