// Single source of truth for funnel steps, progress %, ETA, and copy. Reused by
// ApplyLayout, ResumeJourneyCard, and the resume API so numbers never disagree.

export interface StepDef {
  /** Persisted `currentStep` value on the Application row. */
  key: string;
  /** Route the borrower is sent to in order to CONTINUE from this step (i.e. the
   *  next screen to fill), so completing otp_verified -> the basic-details screen. */
  route: string;
  label: string;
}

// `key` matches Application.currentStep values. `route` is where to send the user
// to CONTINUE from that step (the next screen to fill). `offers`/`submitted`
// resolve to the success page.
export const STEPS: readonly StepDef[] = [
  { key: 'otp_verified',  route: '/apply/basic-details', label: 'Basic Info' },
  { key: 'basic_details', route: '/apply/employment',    label: 'Details' },
  { key: 'employment',    route: '/apply/pan',           label: 'Employment' },
  { key: 'pan_verified',  route: '/apply/offers',        label: 'PAN' },
  { key: 'offers',        route: '/apply/success',       label: 'Offers' },
  { key: 'submitted',     route: '/apply/success',       label: 'Done' },
] as const;

export const STEP_KEYS: readonly string[] = STEPS.map((s) => s.key);

/** Percentage of the funnel completed, 0–100, rounded. */
export function computeProgressPct(completedSteps: string[]): number {
  const valid = new Set(completedSteps.filter((s) => STEP_KEYS.includes(s)));
  const pct = (valid.size / STEPS.length) * 100;
  return Math.min(100, Math.round(pct));
}

// Rough per-remaining-step estimate (minutes). The funnel is short, so ~0.5 min
// per remaining screen, floored at 1 when anything remains, 0 when done.
export function estRemainingMinutes(currentStepKey: string): number {
  const idx = STEP_KEYS.indexOf(currentStepKey);
  const doneIdx = idx === -1 ? 0 : idx + 1;
  const remaining = Math.max(0, STEPS.length - doneIdx);
  if (remaining === 0) return 0;
  return Math.max(1, Math.round(remaining * 0.5));
}

export function motivationalMessage(progressPct: number): string {
  if (progressPct >= 80) return "You're almost there — just one step to unlock your offers.";
  if (progressPct >= 50) return 'Halfway done — a couple of steps to personalized loan offers.';
  if (progressPct >= 25) return 'Great start — pick up right where you left off.';
  return 'Complete your application to unlock personalized loan offers.';
}

export function routeForStep(stepKey: string): string {
  return STEPS.find((s) => s.key === stepKey)?.route ?? '/apply/basic-details';
}
