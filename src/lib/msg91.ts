// MSG91 OTP SMS sender.
//
// We generate + verify the OTP ourselves (stored in Supabase); MSG91 is used
// only to deliver the SMS via a DLT-approved Flow template. This keeps our
// rate-limiting / verification logic in our own DB.
//
// Required env:
//   MSG91_AUTH_KEY        – your MSG91 auth key
//   MSG91_OTP_TEMPLATE_ID – Flow template id approved on DLT
// Optional env:
//   MSG91_OTP_VAR         – the template variable that holds the OTP (default "otp")

const AUTH_KEY = process.env.MSG91_AUTH_KEY;
const TEMPLATE_ID = process.env.MSG91_OTP_TEMPLATE_ID;
const OTP_VAR = process.env.MSG91_OTP_VAR ?? 'otp';

const FLOW_URL = 'https://control.msg91.com/api/v5/flow/';

/** True when MSG91 is configured to actually send SMS. */
export function isMsg91Configured(): boolean {
  return !!(AUTH_KEY && TEMPLATE_ID);
}

/**
 * Send an OTP to an Indian mobile (10 digits, no country code) via MSG91 Flow.
 * Returns { ok: true } on success, or { ok: false, error } on failure.
 */
export async function sendOtpSms(
  mobile: string,
  otp: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isMsg91Configured()) {
    return { ok: false, error: 'MSG91 not configured' };
  }

  try {
    const res = await fetch(FLOW_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: AUTH_KEY as string,
      },
      body: JSON.stringify({
        template_id: TEMPLATE_ID,
        short_url: '0',
        recipients: [{ mobiles: `91${mobile}`, [OTP_VAR]: otp }],
      }),
    });

    const data = (await res.json().catch(() => null)) as { type?: string; message?: string } | null;

    // MSG91 returns { type: "success" } on accept, { type: "error", message } otherwise.
    if (!res.ok || data?.type === 'error') {
      return { ok: false, error: data?.message ?? `MSG91 HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'MSG91 request failed' };
  }
}
