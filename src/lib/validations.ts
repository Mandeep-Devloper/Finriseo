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

// ── Server-side API schemas ─────────────────────────────────────────
// Single source of truth for the request shapes the API routes validate, so the
// funnel client and the server agree on the same rules. Kept here rather than
// inline in each route handler.

const mobile = z.string().regex(/^[6-9]\d{9}$/);
const pan = z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/);

// POST /api/otp/verify
export const otpVerifySchema = z.object({
  mobile,
  idToken: z.string().min(1),
});

// POST /api/application/start
export const applicationStartSchema = z.object({
  mobile,
  fullName: z.string().min(2),
  referenceId: z.string().optional(),
});

// POST /api/application/submit
export const applicationSubmitSchema = z.object({
  referenceId: z.string().optional(),
  mobile,
  fullName: z.string().min(2),
  email: z.string().email().optional(),
  pinCode: z.string().regex(/^\d{6}$/).optional(),
  employmentType: z.string().min(1),
  monthlyIncome: z.coerce.number().positive(),
  salaryMode: z.string().optional(),
  employer: z.string().optional(),
  experience: z.string().optional(),
  loanAmount: z.coerce.number().positive(),
  loanPurpose: z.string().optional(),
  panNumber: pan.optional(),
  selectedOfferId: z.number().optional(),
});

// PATCH /api/application/[referenceId] — every field optional (progressive save)
export const applicationPatchSchema = z.object({
  loanAmount: z.coerce.number().positive().optional(),
  email: z.string().email().optional(),
  pinCode: z.string().regex(/^\d{6}$/).optional(),
  employmentType: z.string().min(1).optional(),
  monthlyIncome: z.coerce.number().positive().optional(),
  salaryMode: z.string().min(1).optional(),
  employer: z.string().optional(),
  experience: z.string().optional(),
  loanPurpose: z.string().optional(),
  panNumber: pan.optional(),
  currentStep: z.string().optional(),
});

// POST /api/application/offers
export const offersSchema = z.object({
  mobile,
  loanAmount: z.coerce.number().positive(),
  employmentType: z.string().min(1),
  monthlyIncome: z.coerce.number().positive(),
});

// GET /api/application/status/[referenceId] — route param
// FIN + 5 time chars + 4 random chars (see generateReferenceId).
export const statusParamSchema = z.object({
  referenceId: z.string().regex(/^FIN[A-Z0-9]{6,12}$/),
});

// POST /api/contact
export const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: mobile,
  subject: z.string().min(5),
  message: z.string().min(20).max(500),
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
