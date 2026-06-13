// In-memory OTP store with auto-cleanup
// Used directly when DATABASE_URL is not set (local dev); DB is used in production

export const otpStore = new Map<string, {
  otp: string;
  expiresAt: number;
  attempts: number;
}>();

const HAS_DB = !!process.env.DATABASE_URL;

export async function saveOtpSession(mobile: string, otp: string, expiresAt: Date) {
  if (HAS_DB) {
    const { db } = await import('@/lib/db');
    await db.otpSession.upsert({
      where: { mobile },
      update: { otp, expiresAt, attempts: 0 },
      create: { mobile, otp, expiresAt },
    });
  } else {
    otpStore.set(mobile, { otp, expiresAt: expiresAt.getTime(), attempts: 0 });
  }
}

export async function getOtpSession(mobile: string) {
  if (HAS_DB) {
    const { db } = await import('@/lib/db');
    return db.otpSession.findUnique({ where: { mobile } });
  }
  const stored = otpStore.get(mobile);
  if (!stored) return null;
  return { otp: stored.otp, expiresAt: new Date(stored.expiresAt), attempts: stored.attempts };
}

export async function incrementOtpAttempts(mobile: string, current: number) {
  if (HAS_DB) {
    const { db } = await import('@/lib/db');
    await db.otpSession.update({ where: { mobile }, data: { attempts: current + 1 } });
  } else {
    const stored = otpStore.get(mobile);
    if (stored) stored.attempts = current + 1;
  }
}

export async function deleteOtpSession(mobile: string) {
  if (HAS_DB) {
    const { db } = await import('@/lib/db');
    try { await db.otpSession.delete({ where: { mobile } }); } catch { /* already deleted */ }
  } else {
    otpStore.delete(mobile);
  }
}

export const rateLimitStore = new Map<string, {
  count: number;
  firstRequest: number;
}>();

// Auto-cleanup every 5 minutes — prevents memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    
    // Clean expired OTPs
    for (const [key, value] of otpStore.entries()) {
      if (now > value.expiresAt) {
        otpStore.delete(key);
      }
    }
    
    // Clean expired rate limit entries (older than 10 minutes)
    for (const [key, value] of rateLimitStore.entries()) {
      if (now - value.firstRequest > 10 * 60 * 1000) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000); // Run every 5 minutes
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function checkRateLimit(
  mobile: string
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const maxRequests = 3;

  const existing = rateLimitStore.get(mobile);
  
  if (!existing || now - existing.firstRequest > windowMs) {
    rateLimitStore.set(mobile, { count: 1, firstRequest: now });
    return { allowed: true };
  }
  
  if (existing.count >= maxRequests) {
    const retryAfter = Math.ceil(
      (existing.firstRequest + windowMs - now) / 1000
    );
    return { allowed: false, retryAfter };
  }
  
  existing.count += 1;
  return { allowed: true };
}

// IP-based rate limiter for submit/contact routes
const ipRateLimitStore = new Map<string, {
  count: number;
  firstRequest: number;
}>();

export function checkIpRateLimit(
  ip: string,
  maxRequests = 5,
  windowMinutes = 60
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;

  const existing = ipRateLimitStore.get(ip);

  if (!existing || now - existing.firstRequest > windowMs) {
    ipRateLimitStore.set(ip, { count: 1, firstRequest: now });
    return { allowed: true };
  }

  if (existing.count >= maxRequests) {
    const retryAfter = Math.ceil(
      (existing.firstRequest + windowMs - now) / 1000
    );
    return { allowed: false, retryAfter };
  }

  existing.count += 1;
  return { allowed: true };
}
