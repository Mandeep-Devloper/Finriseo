// Server-only env validation. Required secrets are checked with Zod the first
// time the server actually needs them, then cached — so a missing/blank var
// fails fast with a clear message instead of surfacing as an opaque
// firebase-admin/Prisma error on the first OTP.
//
// NOTE: validation is intentionally lazy (a function call), never run at module
// import time. `next build` evaluates route modules with these vars absent while
// collecting page data; validating at import would crash the build — the same
// reason firebase-admin initializes lazily.
import 'server-only';
import { z } from 'zod';

const serverEnvSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
});

let cached: z.infer<typeof serverEnvSchema> | null = null;

/**
 * Validate (once) that all required server env vars are present, throwing a
 * clear error listing any that are missing. Returns the parsed values.
 */
export function getServerEnv(): z.infer<typeof serverEnvSchema> {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(
      `[env] Missing/invalid required server env: ${missing}. Set these locally and in Vercel.`
    );
  }
  cached = parsed.data;
  return cached;
}
