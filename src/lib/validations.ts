import { z } from 'zod';
import { PIPELINE_STATUSES } from '@/lib/admin/pipeline';

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

// Alias used by the Hero quick-start form (name + mobile + consent).
export const basicInfoSchema = step1Schema;

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

// POST /api/admin/auth/login — the client signs in with Firebase Email/Password
// and posts the resulting ID token; the server verifies it + checks AdminUser.
export const adminLoginSchema = z.object({
  idToken: z.string().min(1),
});

// ── Admin: application mutations ────────────────────────────────────
// PATCH /api/admin/applications/[referenceId] — discriminated by `op` so each
// action validates its own payload (and the route role-gates each `op`).
export const adminApplicationPatchSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('status'),
    status: z.enum(PIPELINE_STATUSES),
  }),
  z.object({
    op: z.literal('assign'),
    // null clears the assignment (unassign).
    assignedToId: z.string().min(1).nullable(),
  }),
  z.object({
    op: z.literal('disbursement'),
    chosenLenderId: z.number().int().positive(),
    disbursedAmount: z.coerce.number().positive(),
    disbursedAt: z.coerce.date(),
  }),
]);

// POST /api/admin/applications/[referenceId]/notes
export const adminNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note cannot be empty').max(2000),
});

// ── Admin: lender CRUD ──────────────────────────────────────────────
// The client sends numbers as numbers and null for cleared optional fields, so
// these don't coerce. Core fields are required for create; update is partial
// (so an active-only toggle, or any subset, is valid).
const lenderBase = z.object({
  name: z.string().trim().min(1).max(100),
  interestRate: z.number().positive().max(100),         // "from" rate, drives EMI
  interestRateMax: z.number().positive().max(100).nullable().optional(),
  tenureMonths: z.number().int().positive().max(600),
  processingFee: z.string().trim().min(1).max(50),       // display string, e.g. "1.5%"
  color: z.string().trim().regex(/^#?[0-9a-fA-F]{3,8}$/).max(20),
  minIncome: z.number().min(0),
  maxMultiplier: z.number().positive().max(100),
  minAmount: z.number().positive().nullable().optional(),
  maxAmount: z.number().positive().nullable().optional(),
  minAge: z.number().int().min(18).max(100).nullable().optional(),
  maxAge: z.number().int().min(18).max(100).nullable().optional(),
  maxFoir: z.number().positive().max(100).nullable().optional(),
  employmentTypes: z.array(z.string().min(1)).default([]),
  loanTypes: z.array(z.string().min(1)).default([]),
  commissionRate: z.number().min(0).max(100).nullable().optional(),
  priority: z.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
  logoUrl: z.string().url().max(500).nullable().optional(),
});

export const adminLenderCreateSchema = lenderBase;
export const adminLenderUpdateSchema = lenderBase.partial();

// ── Admin: settings ─────────────────────────────────────────────────
// Client sends null for cleared fields, numbers as numbers.
export const adminSettingsSchema = z.object({
  businessName: z.string().trim().max(120).nullable().optional(),
  supportEmail: z.string().trim().email().max(160).nullable().optional(),
  supportPhone: z.string().trim().max(20).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  defaultCommissionRate: z.number().min(0).max(100).nullable().optional(),
});

// ── Admin: team (RBAC) ──────────────────────────────────────────────
const adminRole = z.enum(['SUPER_ADMIN', 'ADMIN', 'AGENT']);

// POST /api/admin/team — invite a new admin/agent.
export const adminInviteSchema = z.object({
  email: z.string().trim().email().max(160),
  name: z.string().trim().min(2).max(120),
  role: adminRole,
});

// PATCH /api/admin/team/[id] — change role and/or active.
export const adminUserUpdateSchema = z
  .object({
    role: adminRole.optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => v.role !== undefined || v.active !== undefined, {
    message: 'Nothing to update',
  });

// POST /api/contact
export const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(160),
  phone: mobile,
  subject: z.string().min(5).max(150),
  message: z.string().min(20).max(500),
});

// Types
export type Step1FormData = z.infer<typeof step1Schema>;
export type OtpFormData = z.infer<typeof otpSchema>;
export type Step2FormData = z.infer<typeof step2Schema>;
export type Step3FormData = z.infer<typeof step3Schema>;
export type Step4FormData = z.infer<typeof step4Schema>;
export type BasicInfoFormData = z.infer<typeof basicInfoSchema>;
