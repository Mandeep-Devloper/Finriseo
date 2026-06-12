export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(window as any).gtag) return;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).gtag('event', eventName, params);
}

// Pre-defined events for the loan apply funnel:
export const EVENTS = {
  HERO_FORM_SUBMIT: 'hero_form_submit',
  APPLY_START: 'apply_start',
  OTP_SENT: 'otp_sent',
  OTP_VERIFIED: 'otp_verified',
  EMPLOYMENT_SUBMITTED: 'employment_submitted',
  OFFER_SELECTED: 'offer_selected',
  APPLICATION_COMPLETE: 'application_complete',
} as const;
