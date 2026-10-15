import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Determine SMTP configuration from environment variables (supporting both HRMS and UTSAV conventions)
const host = process.env.EMAIL_HOST || process.env.SMTP_HOST;
const port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587', 10);
const user = process.env.EMAIL_USER || process.env.SMTP_USER;
const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
const isSecure = port === 465 || process.env.EMAIL_SECURE === 'true' || process.env.SMTP_SECURE === 'true';

const fromName = process.env.FROM_NAME || 'UTSAV Events';
const fromEmail = process.env.FROM_EMAIL || user || 'support@utsav-events.in';

let transporter = null;

if (host && user && pass) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass,
    },
  });

  // Verify SMTP readiness non-blockingly without exposing credentials
  transporter.verify((error) => {
    if (error) {
      console.warn('⚠️ [Nodemailer] SMTP connection warning:', error.message);
    } else {
      console.log('✅ [Nodemailer] SMTP server is ready for outgoing messages.');
    }
  });
} else {
  console.log('ℹ️ [Nodemailer] SMTP credentials not fully configured. Email sending will be simulated locally.');
}

/**
 * Send an email
 * @param {Object} options
 * @param {string} options.to Recipient email address
 * @param {string} [options.email] Alternative recipient field (backward compatibility)
 * @param {string} options.subject Email subject line
 * @param {string} [options.text] Plain text content
 * @param {string} [options.message] Alternative plain text content (backward compatibility)
 * @param {string} [options.html] HTML formatted content
 * @returns {Promise<{ success: boolean, delivered: boolean, simulated?: boolean, messageId?: string }>}
 */
export const sendEmail = async (options) => {
  const recipient = options.to || options.email;
  const subject = options.subject;
  const textContent = options.text || options.message || '';
  const htmlContent = options.html || '';

  if (!recipient) {
    throw new Error('Email recipient address is required.');
  }

  // Safe fallback if SMTP is not configured
  if (!transporter) {
    console.log(`ℹ️ [Email Simulation] To: ${recipient} | Subject: "${subject}"`);
    return { success: true, delivered: false, simulated: true };
  }

  try {
    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: recipient,
      subject,
      text: textContent,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [Email] Sent to ${recipient} (Message ID: ${info.messageId})`);
    return { success: true, delivered: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ [Email] Delivery failure to ${recipient}:`, error.message);
    throw error;
  }
};

/**
 * Send a branded UTSAV Password Reset email
 * @param {Object} params
 * @param {string} params.email Recipient email address
 * @param {string} params.resetUrl Password reset link with token
 * @param {string} [params.userName] User's name if available
 * @returns {Promise<Object>} Delivery result
 */
export const sendPasswordResetEmail = async ({ email, resetUrl, userName }) => {
  const recipientName = userName ? userName.trim() : 'Valued Attendee';
  const subject = 'UTSAV — Password Reset Request';

  const text = `Hello ${recipientName},\n\nYou recently requested to reset your password for your UTSAV account (${email}).\n\nPlease navigate to the following link within 30 minutes to set a new password:\n${resetUrl}\n\nIf you did not request a password reset, please ignore this email. Your password and account will remain safe and unchanged.\n\nWarm regards,\nThe UTSAV Platform Team`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>UTSAV Password Reset</title>
      <style>
        body { margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #292722; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #FAF8F5; padding: 40px 16px; }
        .main-card { max-width: 560px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E7E2DA; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #D96342 0%, #B84728 100%); padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 800; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 500; }
        .content { padding: 36px 32px; }
        .title { margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #1C1917; }
        .lead { margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #57534E; }
        .btn-container { text-align: center; margin: 32px 0; }
        .btn { display: inline-block; background-color: #D96342; color: #FFFFFF !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 12px; box-shadow: 0 2px 8px rgba(217, 99, 66, 0.25); }
        .note-box { background-color: #FFF8F5; border: 1px solid #F3D5CC; border-radius: 12px; padding: 16px; margin: 24px 0; font-size: 12px; line-height: 1.5; color: #8C3E26; }
        .fallback-link { font-size: 12px; color: #78716C; line-height: 1.6; word-break: break-all; margin-top: 24px; padding-top: 20px; border-top: 1px solid #F5F2EB; }
        .fallback-link a { color: #D96342; text-decoration: underline; }
        .footer { padding: 24px 32px; background-color: #FAF8F5; border-top: 1px solid #E7E2DA; text-align: center; font-size: 11px; color: #A8A29E; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="main-card">
          <div class="header">
            <h1>UTSAV</h1>
            <p>Smart Event Management Platform</p>
          </div>
          <div class="content">
            <h2 class="title">Password Reset Request</h2>
            <p class="lead">Hello <strong>${recipientName}</strong>,</p>
            <p class="lead">
              We received a request to reset the password for your UTSAV account associated with <strong>${email}</strong>.
            </p>
            <p class="lead">
              To choose a new password and securely access your tickets and event tools, click the button below:
            </p>
            <div class="btn-container">
              <a href="${resetUrl}" class="btn" target="_blank" rel="noopener noreferrer">
                Reset My Password
              </a>
            </div>
            <div class="note-box">
              ⏱️ <strong>This reset link will expire in 30 minutes.</strong><br/>
              For your account security, this link can only be used once.
            </div>
            <div class="fallback-link">
              Having trouble with the button? Copy and paste this URL into your web browser:<br/>
              <a href="${resetUrl}" target="_blank" rel="noopener noreferrer">${resetUrl}</a>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 6px;">
              If you did not request a password reset, you can safely ignore this email.<br/>
              Your password will remain unchanged and your account is secure.
            </p>
            <p style="margin: 0;">&copy; 2026 UTSAV Platform. India's Curated Event Discovery & Ticketing Platform.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject,
    text,
    html,
  });
};

export default {
  sendEmail,
  sendPasswordResetEmail,
};
