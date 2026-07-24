'use client';

import { useCallback, useRef } from 'react';
import { applicationService } from '@/lib/services';
import type { ApplicationData } from '@/types/application';
import { STEP_KEYS, STEPS, computeProgressPct, routeForStep } from '@/lib/application/progress';

// Build the cumulative completedSteps set up to and including `stepKey`.
function completedThrough(stepKey: string): string[] {
  const idx = STEP_KEYS.indexOf(stepKey);
  if (idx === -1) return [];
  return STEPS.slice(0, idx + 1).map((s) => s.key);
}

/**
 * Draft autosave. `saveStep` persists on Next / step completion with resume
 * metadata; `saveField` debounces per-field blur saves. All saves are
 * fire-and-forget so navigation is never blocked — the DB is the source of truth,
 * and the final submit re-sends everything, so a dropped save never loses data.
 */
export function useAutosave(referenceId: string | undefined) {
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const saveStep = useCallback(
    (stepKey: string, fields: Partial<ApplicationData>) => {
      if (!referenceId) return;
      const completed = completedThrough(stepKey);
      // Strip PAN from the resumable snapshot defensively.
      const snapshot: Record<string, unknown> = { ...fields };
      delete snapshot.panNumber;
      void applicationService
        .updateApplication(referenceId, {
          ...fields,
          currentStep: stepKey,
          currentRoute: routeForStep(stepKey),
          progressPct: computeProgressPct(completed),
          completedSteps: completed,
          draftData: snapshot,
        })
        .catch(() => {});
    },
    [referenceId]
  );

  const saveField = useCallback(
    (field: keyof ApplicationData, value: unknown) => {
      if (!referenceId) return;
      const key = String(field);
      if (key === 'panNumber') return; // never autosave PAN on blur
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => {
        void applicationService
          .updateApplication(referenceId, { [field]: value } as Partial<ApplicationData>)
          .catch(() => {});
      }, 700);
    },
    [referenceId]
  );

  return { saveStep, saveField };
}
