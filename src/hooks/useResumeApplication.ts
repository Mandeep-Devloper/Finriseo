'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApplicationStore } from '@/store/applicationStore';
import type { ApplicationData } from '@/types/application';

interface DraftResponse {
  hasDraft: boolean;
  referenceId?: string;
  currentRoute?: string;
  fields?: Partial<ApplicationData>;
}

/**
 * Restore an in-progress draft into the funnel store from the server (trusted or
 * Firebase session). Used by /apply and by the post-OTP restore path. Runs once.
 */
export function useResumeApplication(opts: { autoRoute?: boolean } = {}) {
  const router = useRouter();
  const hydrate = useApplicationStore((s) => s.hydrateFromServer);
  const [status, setStatus] = useState<'idle' | 'loading' | 'restored' | 'none'>('idle');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    setStatus('loading');
    (async () => {
      try {
        const res = await fetch('/api/application/draft', { credentials: 'same-origin' });
        const data: DraftResponse = await res.json();
        if (data.hasDraft && data.fields) {
          hydrate({ ...data.fields, referenceId: data.referenceId });
          setStatus('restored');
          if (opts.autoRoute && data.currentRoute) router.replace(data.currentRoute);
          return;
        }
        setStatus('none');
      } catch {
        setStatus('none');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status };
}
