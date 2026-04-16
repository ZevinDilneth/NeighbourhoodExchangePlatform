/**
 * SMS service — wraps Twilio in production, falls back to console logging in dev.
 *
 * Required env vars (production only):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 */

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Send a phone verification SMS.
 * In development mode the code is logged to console and never actually sent.
 * Returns the code in dev mode so the controller can echo it back to the client.
 */
export const sendVerificationSms = async (
  phone: string,
  code: string,
): Promise<void> => {
  if (isDev) {
    console.log(`\n📱 [DEV] SMS verification code for ${phone}: ${code}\n`);
    return;
  }

  // ── Production: use Twilio ───────────────────────────────────────────────
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.warn('⚠️  Twilio env vars not set — SMS not sent for', phone);
    return;
  }

  // Dynamic import keeps Twilio out of the bundle when not configured
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const twilio = require('twilio');
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: `Your Neighborhood Exchange verification code is: ${code}. It expires in 10 minutes.`,
      from: TWILIO_FROM_NUMBER,
      to: phone,
    });
  } catch (err) {
    console.error('❌  Failed to send SMS via Twilio:', (err as Error).message);
    throw err;
  }
};
