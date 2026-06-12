import { z } from 'zod';

// Step 1: Full Name + Mobile
export const step1Schema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  consent: z.boolean().refine(val => val === true, { message: 'You must accept the terms to continue' }),
});

// OTP
export const otpSchema = z.object({
  otp: z.string().length(6, 'Enter the complete 6-digit OTP'),
});

// Step 2: Basic Details
export const step2Schema = z.object({
  loanAmount: z.coerce
    .number()
    .min(1000, 'Minimum loan amount is ₹1,000')
    .max(10000000, 'Maximum loan amount is ₹1,00,00,000'),
  email: z.string().email('Enter a valid email address'),
  pinCode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit PIN code'),
});

// Step 3: Employment Details
export const step3Schema = z.object({
  monthlyIncome: z.coerce
    .number()
    .positive('Enter a valid monthly income'),
  employmentType: z.string().min(1, 'Select your employment type'),
  salaryMode: z.string().min(1, 'Select how you receive your salary'),
});

// Step 4: PAN Verification
export const step4Schema = z.object({
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Enter a valid PAN number (e.g. ABCDE1234F)'),
});

// Legacy schemas kept for backward compatibility
export const mobileSchema = step1Schema.pick({ mobile: true });
export const basicInfoSchema = step1Schema;
export const employmentSchema = z.object({
  employmentType: z.string().min(1, 'Select your employment type'),
  monthlyIncome: z.coerce.number().positive('Enter a valid monthly income'),
  employer: z.string().min(1, 'Employer / business name is required'),
  experience: z.string().min(1, 'Select your work experience'),
  loanAmount: z.coerce.number().min(10000, 'Minimum loan amount is ₹10,000').max(5000000, 'Maximum loan amount is ₹50,00,000'),
  loanPurpose: z.string().min(1, 'Select the purpose of your loan'),
});

// Types
export type Step1FormData = z.infer<typeof step1Schema>;
export type OtpFormData = z.infer<typeof otpSchema>;
export type Step2FormData = z.infer<typeof step2Schema>;
export type Step3FormData = z.infer<typeof step3Schema>;
export type Step4FormData = z.infer<typeof step4Schema>;
export type MobileFormData = z.infer<typeof mobileSchema>;
export type BasicInfoFormData = z.infer<typeof basicInfoSchema>;
export type EmploymentFormData = z.infer<typeof employmentSchema>;
