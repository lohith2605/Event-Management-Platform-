import nodemailer from 'nodemailer';

/**
 * Send email utility for password resets and system notices
 */
export const sendEmail = async (options) => {
  // If SMTP is not configured, log locally in development and return false
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log('ℹ️ [Email] SMTP not configured. Simulated email delivery:');
    console.log(`   To: ${options.email}`);
    console.log(`   Subject: ${options.subject}`);
    console.log(`   Content: ${options.message}`);
    return { delivered: false, simulated: true };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const message = {
    from: `${process.env.FROM_NAME || 'UTSAV Events'} <${process.env.FROM_EMAIL || 'support@utsav-events.in'}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  const info = await transporter.sendMail(message);
  return { delivered: true, messageId: info.messageId };
};
