const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function sendEmail(to, subject, html) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Deal.pk <noreply@deal.pk>',
        to: [to],
        subject,
        html,
      }),
    });

    return await response.json();
  } catch (error) {
    console.error('Email error:', error);
    throw new Error('Failed to send email');
  }
}

export async function sendVerificationEmail(email, name, token) {
  const verificationUrl = `https://your-domain.com/verify-email?token=${token}`;
  return sendEmail(
    email,
    'Verify Your Email - Deal.pk',
    `
      <h1>Welcome to Deal.pk!</h1>
      <p>Hi ${name},</p>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${verificationUrl}">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
    `
  );
}

export async function sendPasswordResetEmail(email, name, token) {
  const resetUrl = `https://your-domain.com/reset-password?token=${token}`;
  return sendEmail(
    email,
    'Reset Your Password - Deal.pk',
    `
      <h1>Reset Your Password</h1>
      <p>Hi ${name},</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `
  );
}
