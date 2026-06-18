import { create } from 'zustand';
import type { ApplicationData } from '@/types/application';

const INITIAL_STATE: ApplicationData = {
  mobile: '',
  fullName: '',
  otpVerified: false,
  loanAmount: '',
  email: '',
  pinCode: '',
  employmentType: '',
  monthlyIncome: '',
  salaryMode: '',
  panNumber: '',
  selectedOffer: null,
  referenceId: '',
  submitted: false,
};

// Safe fields — mobile and otpVerified included
// PAN is NOT stored in sessionStorage for security
const SESSION_SAFE_FIELDS: (keyof ApplicationData)[] = [
  'mobile',
  'fullName',
  'otpVerified',
  'loanAmount',
  'email',
  'pinCode',
  'employmentType',
  'monthlyIncome',
  'salaryMode',
  'referenceId',
  'submitted',
];

// Restore saved progress from sessionStorage
function getRestoredState(): Partial<ApplicationData> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = sessionStorage.getItem('finriseo_progress');
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    // Only restore safe fields
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([k]) => SESSION_SAFE_FIELDS.includes(k as keyof ApplicationData)
      )
    ) as Partial<ApplicationData>;
  } catch {
    return {};
  }
}

interface ApplicationStore extends ApplicationData {
  updateData: (updates: Partial<ApplicationData>) => void;
  resetData: () => void;
}

export const useApplicationStore = create<ApplicationStore>((set) => ({
  ...INITIAL_STATE,
  ...getRestoredState(), // Restore on init

  updateData: (updates) =>
    set((state) => {
      const newState = { ...state, ...updates };
      try {
        const safeData = Object.fromEntries(
          Object.entries(newState).filter(([k]) =>
            SESSION_SAFE_FIELDS.includes(k as keyof ApplicationData)
          )
        );
        sessionStorage.setItem(
          'finriseo_progress', 
          JSON.stringify(safeData)
        );
      } catch { /* ignore */ }
      return newState;
    }),

  resetData: () => {
    try {
      sessionStorage.removeItem('finriseo_progress');
    } catch { /* ignore */ }
    set(INITIAL_STATE);
  },
}));
