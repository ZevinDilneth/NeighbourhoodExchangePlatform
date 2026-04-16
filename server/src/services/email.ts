import nodemailer from 'nodemailer';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const FROM_NAME  = 'Neighborhood Exchange';
const FROM_EMAIL = process.env.SMTP_USER as string; // your Gmail address

// ── Transporter (lazy singleton) ─────────────────────────────────────────────
// Uses Gmail SMTP with an App Password — instant delivery, no sender
// verification required.  Generate an App Password at:
// https://myaccount.google.com/apppasswords  (2-Step Verification must be on)
let _transporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter => {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // 16-char App Password (no spaces)
      },
    });
  }
  return _transporter;
};

// ─── Shared brand header ───────────────────────────────────────────────────
const emailHeader = `
  <div style="background:linear-gradient(135deg,#4F46E5,#10B981);padding:32px 24px;text-align:center">
    <div style="display:inline-block;background:rgba(255,255,255,0.2);width:52px;height:52px;border-radius:10px;line-height:52px;font-size:22px;margin-bottom:12px">🤝</div>
    <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;font-family:sans-serif;letter-spacing:-0.3px">
      Neighborhood Exchange
    </h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;font-family:sans-serif">
      Share Skills • Build Community
    </p>
  </div>
`;

const emailWrapper = (body: string) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #E5E7EB;overflow:hidden">
        <tr><td>${emailHeader}</td></tr>
        <tr><td style="padding:32px 36px">${body}</td></tr>
        <tr>
          <td style="padding:20px 36px 28px;border-top:1px solid #F3F4F6;text-align:center">
            <p style="color:#9CA3AF;font-size:12px;margin:0;line-height:1.6">
              You received this email because you have an account on Neighborhood Exchange.<br>
              If you didn't request this, please ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

// ─── Internal send helper ──────────────────────────────────────────────────
const sendMail = async (to: string, subject: string, html: string): Promise<void> => {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    subject,
    html,
  });
  console.log(`✅ Email sent → ${to} | Subject: "${subject}"`);
};

// ─── Verification email ────────────────────────────────────────────────────
export const sendVerificationEmail = async (
  email: string,
  name: string,
  token: string
): Promise<void> => {
  const verifyUrl = `${CLIENT_URL}/verify-email?token=${token}`;
  const firstName = name.split(' ')[0];

  const body = `
    <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 8px;font-family:sans-serif">
      Verify your email address
    </h2>
    <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 24px">
      Hi ${firstName}, thanks for joining! Click the button below to confirm your email address and activate your account.
    </p>
    <a href="${verifyUrl}"
       style="display:block;background:linear-gradient(135deg,#4F46E5,#10B981);color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;text-align:center;font-weight:600;font-size:15px;margin-bottom:24px;font-family:sans-serif">
      ✓ Verify My Email
    </a>
    <div style="background:#F9FAFB;border-radius:8px;padding:14px 16px;margin-bottom:0">
      <p style="color:#6B7280;font-size:13px;margin:0;line-height:1.5">
        <strong style="color:#374151">Link not working?</strong> Copy and paste this URL into your browser:<br>
        <span style="color:#4F46E5;word-break:break-all">${verifyUrl}</span>
      </p>
    </div>
    <p style="color:#9CA3AF;font-size:12px;margin:20px 0 0">
      This link expires in <strong>24 hours</strong>.
    </p>
  `;

  try {
    await sendMail(email, 'Verify your email — Neighborhood Exchange', emailWrapper(body));
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error('❌ Verification email failed:', e?.message);
    throw err;
  }
};

// ─── Email change verification code ───────────────────────────────────────
export const sendEmailChangeCode = async (
  email: string,
  name: string,
  code: string,
): Promise<void> => {
  const firstName = name.split(' ')[0];

  const body = `
    <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 8px;font-family:sans-serif">
      Verify your new email address
    </h2>
    <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 24px">
      Hi ${firstName}, you requested to change the email address on your Neighborhood Exchange account.
      Use the code below to confirm your new address.
    </p>
    <div style="background:#F9FAFB;border:2px dashed #4F46E5;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
      <p style="color:#6B7280;font-size:13px;margin:0 0 8px;font-family:sans-serif">Your verification code</p>
      <span style="font-size:36px;font-weight:700;color:#4F46E5;letter-spacing:0.25em;font-family:monospace">${code}</span>
      <p style="color:#9CA3AF;font-size:12px;margin:12px 0 0;font-family:sans-serif">Expires in 10 minutes</p>
    </div>
    <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:14px 16px">
      <p style="color:#92400E;font-size:13px;margin:0;line-height:1.5">
        ⚠️ If you didn't request this change, please ignore this email — your current address will remain unchanged.
      </p>
    </div>
  `;

  try {
    await sendMail(email, 'Verify your new email — Neighborhood Exchange', emailWrapper(body));
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error('❌ Email change code failed:', e?.message);
    throw err;
  }
};

// ─── Password reset email ──────────────────────────────────────────────────
export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  token: string
): Promise<void> => {
  const resetUrl = `${CLIENT_URL}/reset-password?token=${token}`;
  const firstName = name.split(' ')[0];

  const body = `
    <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 8px;font-family:sans-serif">
      Reset your password
    </h2>
    <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 24px">
      Hi ${firstName}, we received a request to reset the password for your Neighborhood Exchange account. Click the button below to choose a new password.
    </p>
    <a href="${resetUrl}"
       style="display:block;background:linear-gradient(135deg,#4F46E5,#10B981);color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;text-align:center;font-weight:600;font-size:15px;margin-bottom:24px;font-family:sans-serif">
      Reset My Password
    </a>
    <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:14px 16px;margin-bottom:16px">
      <p style="color:#92400E;font-size:13px;margin:0;line-height:1.5">
        ⚠️ This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password will not change.
      </p>
    </div>
    <div style="background:#F9FAFB;border-radius:8px;padding:14px 16px">
      <p style="color:#6B7280;font-size:13px;margin:0;line-height:1.5">
        <strong style="color:#374151">Link not working?</strong> Copy and paste this URL into your browser:<br>
        <span style="color:#4F46E5;word-break:break-all">${resetUrl}</span>
      </p>
    </div>
  `;

  try {
    await sendMail(email, 'Reset your password — Neighborhood Exchange', emailWrapper(body));
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error('❌ Password reset email failed:', e?.message);
    throw err;
  }
};
