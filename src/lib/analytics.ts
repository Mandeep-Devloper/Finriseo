// gtag is injected by the GoogleAnalytics component (production only, and only
// when a measurement ID is configured) — so it is optional on window and every
// call must tolerate its absence.
declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: Record<string, unknown>) => void;
  }
}

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', eventName, params);
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
