import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Ticket from '../models/Ticket.js';

dotenv.config();

// Determine SMTP configuration from environment variables
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
 * Accessor & setter for transporter (supports automated mock testing)
 */
export const getTransporter = () => transporter;
export const setTransporter = (newTransporter) => {
  transporter = newTransporter;
};

/**
 * Send a generic email
 * @param {Object} options
 * @param {string} options.to Recipient email address
 * @param {string} [options.email] Alternative recipient field (backward compatibility)
 * @param {string} options.subject Email subject line
 * @param {string} [options.text] Plain text content
 * @param {string} [options.message] Alternative plain text content (backward compatibility)
 * @param {string} [options.html] HTML formatted content
 * @param {Array} [options.attachments] Inline or file attachments
 * @returns {Promise<{ success: boolean, delivered: boolean, simulated?: boolean, messageId?: string }>}
 */
export const sendEmail = async (options) => {
  const recipient = options.to || options.email;
  const subject = options.subject;
  const textContent = options.text || options.message || '';
  const htmlContent = options.html || '';
  const attachments = options.attachments || [];

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
      attachments,
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

/**
 * Send branded UTSAV Booking Confirmation email with dynamic QR ticket passes
 */
export const sendBookingConfirmationEmail = async ({ booking, event, user, tickets = [] }) => {
  const recipient = user?.email || booking.attendeeEmail;
  const recipientName = user?.name || booking.attendeeName || 'Valued Attendee';
  const eventTitle = event?.title || 'UTSAV Event';
  const eventDate = event?.date || 'Upcoming';
  const eventTime = event?.time || '';
  const isOnline =
    event?.format === 'Online' ||
    event?.city === 'Online' ||
    (event?.venue && event.venue.toLowerCase().includes('online'));
  const eventLocation = isOnline
    ? 'Online Event (Access link available in your UTSAV dashboard)'
    : `${event?.venue || 'Venue TBD'}, ${event?.city || ''}`;

  const isFree = booking.paymentStatus === 'free' || booking.totalAmount === 0;
  const paymentBadge = isFree ? 'Complimentary Access (Free Pass)' : 'Paid & Verified (Razorpay)';
  const totalAmountText = isFree ? '₹0 (Free Pass)' : `₹${booking.totalAmount}`;
  const subject = `🎟️ Booking Confirmed: ${eventTitle} [${booking.bookingReference}]`;
  const myTicketsUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/attendee/tickets`;

  // Generate QR Code PNG buffers for each issued ticket
  const attachments = [];
  const ticketCardsHtml = [];
  const plainTextTickets = [];

  for (let idx = 0; idx < tickets.length; idx++) {
    const t = tickets[idx];
    const cid = `qr_${t.ticketCode}`;

    let qrImageTag = '';
    try {
      const qrBuffer = await QRCode.toBuffer(t.qrData, {
        type: 'png',
        width: 220,
        margin: 1,
        errorCorrectionLevel: 'M',
      });

      attachments.push({
        filename: `ticket-${t.ticketCode}.png`,
        content: qrBuffer,
        cid,
        contentType: 'image/png',
      });

      qrImageTag = `<img src="cid:${cid}" alt="${t.ticketCode} QR Code" width="160" height="160" style="display:block;margin:12px auto;border-radius:12px;background:#ffffff;padding:8px;border:1px solid #E7E2DA;" />`;
    } catch (qrErr) {
      console.warn(`Failed to generate QR buffer for ${t.ticketCode}:`, qrErr.message);
      qrImageTag = `<div style="padding:16px;background:#f8fafc;border-radius:8px;font-family:monospace;font-weight:bold;color:#475569;">[QR: ${t.ticketCode}]</div>`;
    }

    ticketCardsHtml.push(`
      <div style="background-color:#FFFFFF;border:1px solid #E7E2DA;border-radius:14px;padding:20px;margin-bottom:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.03);">
        <div style="margin-bottom:8px;">
          <span style="font-size:11px;font-weight:700;color:#D96342;text-transform:uppercase;letter-spacing:0.5px;">Pass ${idx + 1} of ${tickets.length}</span>
          <span style="font-size:11px;font-weight:600;color:#78716C;margin-left:8px;">• Seat: ${t.seatNumber || 'GA'}</span>
        </div>
        <div style="font-size:16px;font-weight:800;color:#1C1917;margin-bottom:4px;">${t.ticketType || 'General Admission'}</div>
        <div style="font-size:12px;color:#57534E;margin-bottom:12px;">Attendee: <strong>${t.attendeeName}</strong></div>
        
        ${qrImageTag}
        
        <div style="margin-top:10px;">
          <span style="font-family:monospace;font-size:13px;font-weight:700;letter-spacing:1px;color:#1C1917;display:block;">${t.ticketCode}</span>
          <span style="display:inline-block;margin-top:6px;font-size:10px;font-weight:700;color:#065F46;background-color:#D1FAE5;padding:3px 10px;border-radius:9999px;">
            ✓ Verified Admission Pass
          </span>
        </div>
      </div>
    `);

    plainTextTickets.push(
      `Pass #${idx + 1}: ${t.ticketCode} | Tier: ${t.ticketType || 'General Admission'} | Seat: ${t.seatNumber || 'GA'} | Attendee: ${t.attendeeName}`
    );
  }

  const text = `Hello ${recipientName},\n\nYour booking for "${eventTitle}" has been confirmed!\n\nBooking Reference: ${booking.bookingReference}\nEvent: ${eventTitle}\nDate & Time: ${eventDate} • ${eventTime}\nVenue: ${eventLocation}\nTickets: ${booking.quantity}x ${booking.ticketType} (${totalAmountText})\nPayment Status: ${paymentBadge}${booking.razorpayPaymentId ? `\nPayment ID: ${booking.razorpayPaymentId}` : ''}\n\nYour Issued Digital Ticket Passes:\n${plainTextTickets.join('\n')}\n\nYou can present the dynamic QR codes attached to this email at the entrance, or access your interactive passes anytime in your UTSAV dashboard:\n${myTicketsUrl}\n\nThank you for choosing UTSAV — India's Curated Event Discovery & Ticketing Platform.`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>UTSAV Booking Confirmed</title>
      <style>
        body { margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #292722; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #FAF8F5; padding: 40px 16px; }
        .main-card { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E7E2DA; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #D96342 0%, #B84728 100%); padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; color: #FFFFFF; font-size: 26px; font-weight: 800; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 500; }
        .content { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #ECFDF5; color: #047857; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; border: 1px solid #A7F3D0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .title { margin: 0 0 8px; font-size: 22px; font-weight: 800; color: #1C1917; }
        .lead { margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #57534E; }
        .event-card { background-color: #FAF8F5; border: 1px solid #E7E2DA; border-radius: 14px; padding: 20px; margin: 20px 0; }
        .event-title { font-size: 18px; font-weight: 800; color: #1C1917; margin: 0 0 12px; }
        .meta-row { margin-bottom: 6px; font-size: 13px; color: #57534E; }
        .meta-label { font-weight: 700; color: #1C1917; display: inline-block; min-width: 110px; }
        .summary-table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px; }
        .summary-table th { text-align: left; padding: 10px 12px; background-color: #FAF8F5; border-bottom: 2px solid #E7E2DA; color: #78716C; font-size: 11px; text-transform: uppercase; font-weight: 700; }
        .summary-table td { padding: 12px; border-bottom: 1px solid #F5F2EB; color: #1C1917; }
        .total-row td { font-weight: 800; font-size: 14px; color: #D96342; border-top: 2px solid #E7E2DA; border-bottom: none; }
        .btn-container { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background-color: #D96342; color: #FFFFFF !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 12px; box-shadow: 0 2px 8px rgba(217, 99, 66, 0.25); }
        .footer { padding: 24px 28px; background-color: #FAF8F5; border-top: 1px solid #E7E2DA; text-align: center; font-size: 11px; color: #A8A29E; line-height: 1.6; }
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
            <div class="badge">✓ Booking Confirmed</div>
            <h2 class="title">You're Going to ${eventTitle}!</h2>
            <p class="lead">
              Hello <strong>${recipientName}</strong>, your reservation has been confirmed and your verified digital tickets are attached below.
            </p>

            <div class="event-card">
              <div class="event-title">${eventTitle}</div>
              <div class="meta-row">
                <span class="meta-label">📅 Date & Time:</span>
                <span>${eventDate} • ${eventTime}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">📍 Location:</span>
                <span>${eventLocation}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">🏷️ Category:</span>
                <span>${event?.category || 'Event'}</span>
              </div>
            </div>

            <table class="summary-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>${booking.ticketType || 'General Admission'}</strong><br/>
                    <span style="font-size:11px;color:#78716C;">Ref: ${booking.bookingReference}</span>
                  </td>
                  <td>${booking.quantity}</td>
                  <td style="text-align:right;">${isFree ? 'Free' : `₹${booking.unitPrice} each`}</td>
                </tr>
                <tr class="total-row">
                  <td colspan="2">Total (${paymentBadge})</td>
                  <td style="text-align:right;">${totalAmountText}</td>
                </tr>
              </tbody>
            </table>

            ${booking.razorpayPaymentId ? `
              <div style="background-color:#F5F3FF;border:1px solid #DDD6FE;border-radius:10px;padding:12px 16px;margin:16px 0;font-size:12px;color:#5B21B6;">
                <strong>💳 Razorpay Payment ID:</strong> <span style="font-family:monospace;font-weight:700;">${booking.razorpayPaymentId}</span>
              </div>
            ` : ''}

            <h3 style="font-size:16px;font-weight:800;color:#1C1917;margin:28px 0 14px;">Your Digital Admission Passes</h3>
            <p style="font-size:12px;color:#78716C;margin-bottom:18px;">
              Present these verified dynamic QR codes on your mobile device at the venue gate for direct check-in.
            </p>

            ${ticketCardsHtml.join('')}

            <div class="btn-container">
              <a href="${myTicketsUrl}" class="btn" target="_blank" rel="noopener noreferrer">
                Access All Passes in My Tickets
              </a>
            </div>

            <div style="background-color:#FFF8F5;border:1px solid #F3D5CC;border-radius:12px;padding:16px;margin:24px 0;font-size:12px;line-height:1.5;color:#8C3E26;">
              ℹ️ <strong>Admission Guidelines:</strong><br/>
              • Ensure your phone screen brightness is set to high when scanning at the desk.<br/>
              • Passes are uniquely signed and non-transferable without authorized booking transfer.
            </div>
          </div>
          <div class="footer">
            <p style="margin:0 0 6px;">Questions about your reservation? Contact support at <strong>${fromEmail}</strong>.</p>
            <p style="margin:0;">&copy; 2026 UTSAV Platform. India's Curated Event Discovery & Ticketing Platform.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: recipient,
    subject,
    text,
    html,
    attachments,
  });
};

/**
 * Safely triggers the booking confirmation email with atomic duplicate prevention.
 * Non-blocking: Email delivery errors are recorded on the booking but never throw or undo transactions.
 * @param {string|mongoose.Types.ObjectId} bookingId
 * @returns {Promise<{ success: boolean, delivered?: boolean, skipped?: boolean, reason?: string, error?: string, messageId?: string }>}
 */
export const sendConfirmationEmailForBooking = async (param) => {
  const bookingId = typeof param === 'object' && param !== null && !param._bsontype ? (param.bookingId || param.id || param) : param;
  if (!bookingId) return { success: false, error: 'No booking ID provided' };

  try {
    // 1. Fetch booking to check eligibility
    const existing = await Booking.findById(bookingId).populate('eventId');
    if (!existing) {
      return { success: false, error: 'Booking not found' };
    }

    // Must be confirmed (free or verified paid)
    if (existing.status !== 'confirmed') {
      return { success: true, skipped: true, reason: 'booking_not_confirmed' };
    }

    // Duplicate check: Already sent
    if (existing.confirmationEmailSent === true) {
      return { success: true, skipped: true, reason: 'already_sent' };
    }

    // 2. Atomic concurrency lock: transition confirmationEmailStatus to 'processing'
    // Guarantees only ONE worker/callback sends the email even under parallel webhook execution
    const claimed = await Booking.findOneAndUpdate(
      {
        _id: bookingId,
        confirmationEmailSent: { $ne: true },
        confirmationEmailStatus: { $ne: 'processing' },
      },
      {
        $set: { confirmationEmailStatus: 'processing' },
      },
      { new: true }
    ).populate('eventId');

    if (!claimed) {
      return { success: true, skipped: true, reason: 'concurrency_lock' };
    }

    // 3. Fetch attendee and issued tickets
    const [user, tickets] = await Promise.all([
      User.findById(claimed.userId),
      Ticket.find({ bookingId: claimed._id }),
    ]);

    const attendeeRecord = user || {
      name: claimed.attendeeName,
      email: claimed.attendeeEmail,
    };

    // 4. Send email
    const emailResult = await sendBookingConfirmationEmail({
      booking: claimed,
      event: claimed.eventId,
      user: attendeeRecord,
      tickets,
    });

    // 5. Record successful delivery state
    claimed.confirmationEmailSent = true;
    claimed.confirmationEmailSentAt = new Date();
    claimed.confirmationEmailStatus = 'sent';
    claimed.confirmationEmailMessageId =
      emailResult?.messageId || (emailResult?.simulated ? 'SIMULATED' : 'DELIVERED');
    claimed.confirmationEmailError = '';
    await claimed.save();

    console.log(`✅ [Confirmation Email] Dispatched for ${claimed.bookingReference} to ${attendeeRecord.email}`);
    return { success: true, delivered: !!emailResult?.delivered, messageId: claimed.confirmationEmailMessageId };
  } catch (err) {
    console.error(`⚠️ [Confirmation Email Error] Booking ${bookingId}:`, err.message);
    // Non-blocking failure record
    try {
      await Booking.findByIdAndUpdate(bookingId, {
        $set: {
          confirmationEmailStatus: 'failed',
          confirmationEmailError: err.message,
        },
      });
    } catch (saveErr) {
      // ignore
    }
    return { success: false, error: err.message };
  }
};

/**
 * Send branded UTSAV Ticket Cancellation & Refund Notification email
 */
export const sendCancellationEmail = async ({ booking, event, user, tickets = [] }) => {
  const recipient = user?.email || booking.attendeeEmail;
  const recipientName = user?.name || booking.attendeeName || 'Valued Attendee';
  const eventTitle = event?.title || 'UTSAV Event';
  const eventDate = event?.date || 'Upcoming';
  const eventTime = event?.time || '';
  const isOnline =
    event?.format === 'Online' ||
    event?.city === 'Online' ||
    (event?.venue && event.venue.toLowerCase().includes('online'));
  const eventLocation = isOnline
    ? 'Online Event'
    : `${event?.venue || 'Venue TBD'}, ${event?.city || ''}`;

  const reason = booking.cancellationReason || 'Administrative cancellation request';
  const subject = `Your UTSAV ticket has been cancelled [${booking.bookingReference}]`;
  const myBookingsUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/attendee/bookings`;

  // Determine refund messaging based on refundStatus
  const refundStatus = booking.refundStatus || (booking.totalAmount === 0 ? 'not_applicable' : 'none');
  const refundAmount = booking.refundAmount || booking.totalAmount || 0;

  let refundBadge = '';
  let refundHeading = '';
  let refundExplanation = '';
  let refundBoxBorder = '#E7E2DA';
  let refundBoxBg = '#FAF8F5';
  let refundTextColor = '#1C1917';

  switch (refundStatus) {
    case 'processed':
      refundBadge = '✓ REFUND COMPLETED';
      refundHeading = `Full Refund of ₹${refundAmount} Processed`;
      refundExplanation = `A full refund of ₹${refundAmount} has been processed via Razorpay${
        booking.razorpayRefundId ? ` (Refund ID: ${booking.razorpayRefundId})` : ''
      } back to your original payment method. Depending on your bank's settlement cycle, funds typically appear in your account within 5–7 business days.`;
      refundBoxBorder = '#A7F3D0';
      refundBoxBg = '#ECFDF5';
      refundTextColor = '#065F46';
      break;

    case 'initiated':
      refundBadge = '⏳ REFUND INITIATED & PROCESSING';
      refundHeading = `Refund of ₹${refundAmount} Initiated`;
      refundExplanation = `Your refund of ₹${refundAmount} has been submitted to Razorpay${
        booking.razorpayRefundId ? ` (Refund ID: ${booking.razorpayRefundId})` : ''
      } and is currently being processed by the banking network. It will be credited to your original payment method once settled.`;
      refundBoxBorder = '#FDE68A';
      refundBoxBg = '#FFFBEB';
      refundTextColor = '#92400E';
      break;

    case 'failed':
      refundBadge = '⚠️ REFUND UNDER REVIEW';
      refundHeading = `Refund Pending Manual Settlement (₹${refundAmount})`;
      refundExplanation = `An automated gateway refund could not be cleared immediately${
        booking.refundError ? ` (${booking.refundError})` : ''
      }. Our administrative finance team has flagged your booking and will manually ensure your refund is settled.`;
      refundBoxBorder = '#FECACA';
      refundBoxBg = '#FEF2F2';
      refundTextColor = '#991B1B';
      break;

    case 'not_applicable':
      refundBadge = '🎟️ COMPLIMENTARY PASS';
      refundHeading = 'No Refund Required';
      refundExplanation =
        'This booking was for a complimentary event pass; no payment was charged, so no financial refund is necessary.';
      refundBoxBorder = '#E7E2DA';
      refundBoxBg = '#FAF8F5';
      refundTextColor = '#57534E';
      break;

    default: // 'none'
      refundBadge = '⏱️ HOLD RELEASED';
      refundHeading = 'No Payment Captured';
      refundExplanation =
        'This booking was unpaid or in pending hold. The hold has been released and no money was deducted from your account.';
      refundBoxBorder = '#E7E2DA';
      refundBoxBg = '#FAF8F5';
      refundTextColor = '#57534E';
      break;
  }

  const ticketCodesText = tickets.length > 0
    ? tickets.map((t) => `${t.ticketCode} (${t.ticketType || 'GA'}) - DEACTIVATED`).join('\n')
    : `${booking.bookingReference} (${booking.quantity}x ${booking.ticketType}) - DEACTIVATED`;

  const text = `Hello ${recipientName},\n\nThis is to notify you that your booking for "${eventTitle}" has been cancelled.\n\nBooking Reference: ${booking.bookingReference}\nEvent: ${eventTitle}\nDate & Time: ${eventDate} • ${eventTime}\nVenue: ${eventLocation}\nTickets: ${booking.quantity}x ${booking.ticketType}\nCancellation Reason: ${reason}\n\nDeactivated Digital Passes:\n${ticketCodesText}\n\nRefund Status: ${refundHeading}\n${refundExplanation}\n\nAll digital passes and QR codes associated with this booking have been deactivated and cannot be used for admission.\n\nYou can review your cancelled bookings and order records in your UTSAV account:\n${myBookingsUrl}\n\nIf you have any questions or require further assistance, please contact our support team at ${fromEmail}.\n\nWarm regards,\nThe UTSAV Platform Team`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>UTSAV Ticket Cancellation & Refund</title>
      <style>
        body { margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #292722; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #FAF8F5; padding: 40px 16px; }
        .main-card { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E7E2DA; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #1C1917 0%, #292524 100%); padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; color: #FFFFFF; font-size: 26px; font-weight: 800; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0; color: rgba(255, 255, 255, 0.8); font-size: 13px; font-weight: 500; }
        .content { padding: 32px 28px; }
        .status-badge { display: inline-block; background-color: #FEF2F2; color: #DC2626; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 9999px; border: 1px solid #FECACA; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .title { margin: 0 0 8px; font-size: 22px; font-weight: 800; color: #1C1917; }
        .lead { margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #57534E; }
        .details-card { background-color: #FAF8F5; border: 1px solid #E7E2DA; border-radius: 14px; padding: 20px; margin: 20px 0; }
        .meta-row { margin-bottom: 8px; font-size: 13px; color: #57534E; }
        .meta-label { font-weight: 700; color: #1C1917; display: inline-block; min-width: 120px; }
        .refund-card { background-color: ${refundBoxBg}; border: 1px solid ${refundBoxBorder}; border-radius: 14px; padding: 20px; margin: 24px 0; }
        .refund-title { font-size: 15px; font-weight: 800; color: ${refundTextColor}; margin: 0 0 8px; }
        .refund-desc { font-size: 13px; line-height: 1.6; color: ${refundTextColor}; margin: 0; }
        .deactivated-box { background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 12px; line-height: 1.6; color: #991B1B; }
        .btn-container { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background-color: #D96342; color: #FFFFFF !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 12px; box-shadow: 0 2px 8px rgba(217, 99, 66, 0.25); }
        .footer { padding: 24px 28px; background-color: #FAF8F5; border-top: 1px solid #E7E2DA; text-align: center; font-size: 11px; color: #A8A29E; line-height: 1.6; }
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
            <div class="status-badge">❌ Booking Cancelled</div>
            <h2 class="title">Your Ticket Has Been Cancelled</h2>
            <p class="lead">
              Hello <strong>${recipientName}</strong>, this is an official notification that your booking for <strong>${eventTitle}</strong> has been cancelled.
            </p>

            <div class="details-card">
              <div class="meta-row">
                <span class="meta-label">Event:</span>
                <strong style="color:#1C1917;">${eventTitle}</strong>
              </div>
              <div class="meta-row">
                <span class="meta-label">Date & Time:</span>
                <span>${eventDate} • ${eventTime}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Location:</span>
                <span>${eventLocation}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Booking Ref:</span>
                <span style="font-family:monospace;font-weight:700;">${booking.bookingReference}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Passes:</span>
                <span>${booking.quantity}x ${booking.ticketType || 'General Admission'}</span>
              </div>
              <div class="meta-row" style="margin-bottom:0;">
                <span class="meta-label">Reason:</span>
                <span>${reason}</span>
              </div>
            </div>

            <!-- Refund Status Card -->
            <div class="refund-card">
              <span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:0.5px;padding:3px 8px;border-radius:6px;background:rgba(255,255,255,0.7);margin-bottom:8px;color:${refundTextColor};">
                ${refundBadge}
              </span>
              <div class="refund-title">${refundHeading}</div>
              <p class="refund-desc">${refundExplanation}</p>
            </div>

            <!-- Deactivation Warning -->
            <div class="deactivated-box">
              ⛔ <strong>Digital Passes Deactivated:</strong><br/>
              The digital passes and dynamic QR codes issued for this reservation have been deactivated in the admission registry. They will scan as invalid at the event entrance.
              ${tickets.length > 0 ? `
                <div style="margin-top:8px;font-family:monospace;font-size:11px;color:#7F1D1D;">
                  ${tickets.map(t => `&bull; ${t.ticketCode} (${t.seatNumber || 'GA'})`).join('<br/>')}
                </div>
              ` : ''}
            </div>

            <div class="btn-container">
              <a href="${myBookingsUrl}" class="btn" target="_blank" rel="noopener noreferrer">
                View My Bookings on UTSAV
              </a>
            </div>
          </div>
          <div class="footer">
            <p style="margin:0 0 6px;">Questions about your cancellation or refund? Contact our support desk at <strong>${fromEmail}</strong>.</p>
            <p style="margin:0;">&copy; 2026 UTSAV Platform. India's Curated Event Discovery & Ticketing Platform.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: recipient,
    subject,
    text,
    html,
  });
};

/**
 * Safely triggers the cancellation email for a booking with atomic duplicate prevention.
 * Non-blocking: Errors are recorded on booking but never throw or undo transactions.
 * @param {string|mongoose.Types.ObjectId} bookingId
 * @returns {Promise<{ success: boolean, delivered?: boolean, skipped?: boolean, reason?: string, error?: string, messageId?: string }>}
 */
export const sendCancellationEmailForBooking = async (param) => {
  const bookingId = typeof param === 'object' && param !== null && !param._bsontype ? (param.bookingId || param.id || param) : param;
  if (!bookingId) return { success: false, error: 'No booking ID provided' };

  try {
    const existing = await Booking.findById(bookingId).populate('eventId');
    if (!existing) {
      return { success: false, error: 'Booking not found' };
    }

    if (existing.status !== 'cancelled') {
      return { success: true, skipped: true, reason: 'booking_not_cancelled' };
    }

    if (existing.cancellationEmailSent === true) {
      return { success: true, skipped: true, reason: 'already_sent' };
    }

    // Atomic concurrency claim
    const claimed = await Booking.findOneAndUpdate(
      {
        _id: bookingId,
        status: 'cancelled',
        cancellationEmailSent: { $ne: true },
        cancellationEmailStatus: { $ne: 'processing' },
      },
      {
        $set: { cancellationEmailStatus: 'processing' },
      },
      { new: true }
    ).populate('eventId');

    if (!claimed) {
      return { success: true, skipped: true, reason: 'concurrency_lock' };
    }

    const [user, tickets] = await Promise.all([
      User.findById(claimed.userId),
      Ticket.find({ bookingId: claimed._id }),
    ]);

    const attendeeRecord = user || {
      name: claimed.attendeeName,
      email: claimed.attendeeEmail,
    };

    const emailResult = await sendCancellationEmail({
      booking: claimed,
      event: claimed.eventId,
      user: attendeeRecord,
      tickets,
    });

    claimed.cancellationEmailSent = true;
    claimed.cancellationEmailSentAt = new Date();
    claimed.cancellationEmailStatus = 'sent';
    claimed.cancellationEmailMessageId =
      emailResult?.messageId || (emailResult?.simulated ? 'SIMULATED' : 'DELIVERED');
    claimed.cancellationEmailError = '';
    await claimed.save();

    console.log(`✅ [Cancellation Email] Dispatched for ${claimed.bookingReference} to ${attendeeRecord.email}`);
    return { success: true, delivered: !!emailResult?.delivered, messageId: claimed.cancellationEmailMessageId };
  } catch (err) {
    console.error(`⚠️ [Cancellation Email Error] Booking ${bookingId}:`, err.message);
    try {
      await Booking.findByIdAndUpdate(bookingId, {
        $set: {
          cancellationEmailStatus: 'failed',
          cancellationEmailError: err.message,
        },
      });
    } catch (saveErr) {
      // ignore
    }
    return { success: false, error: err.message };
  }
};

/**
 * Send branded UTSAV Event Reminder Email (24h or 2h before event)
 */
export const sendEventReminderEmail = async ({
  booking,
  event,
  user,
  reminderType = '24h',
  tickets = [],
}) => {
  const recipient = user?.email || booking.attendeeEmail;
  const recipientName = user?.name || booking.attendeeName || 'Valued Attendee';
  const eventTitle = event?.title || 'UTSAV Event';
  const eventDate = event?.date || 'Upcoming';
  const eventTime = event?.time || '';
  const isOnline =
    event?.format === 'Online' ||
    event?.city === 'Online' ||
    (event?.venue && event.venue.toLowerCase().includes('online'));
  const eventLocation = isOnline
    ? 'Online Event (Access link available in your UTSAV dashboard)'
    : `${event?.venue || 'Venue TBD'}, ${event?.city || ''}`;

  const is24h = reminderType === '24h';
  const subject = is24h
    ? `⏰ Reminder: "${eventTitle}" is happening tomorrow! [${booking.bookingReference}]`
    : `🚨 Final Reminder: "${eventTitle}" starts in 2 hours! [${booking.bookingReference}]`;

  const bannerBadge = is24h
    ? '⏰ TOMORROW • 24-HOUR REMINDER'
    : '🚨 STARTING SOON • 2-HOUR REMINDER';

  const heading = is24h
    ? `Get Ready! "${eventTitle}" is Tomorrow`
    : `Starting in 2 Hours: "${eventTitle}"`;

  const leadText = is24h
    ? `Hello <strong>${recipientName}</strong>, this is your friendly 24-hour reminder that your upcoming registered experience <strong>${eventTitle}</strong> takes place tomorrow.`
    : `Hello <strong>${recipientName}</strong>, your registered event <strong>${eventTitle}</strong> kicks off in just <strong>2 hours</strong>! Gates and check-in desks are opening.`;

  const tipsText = is24h
    ? `Plan your arrival: We recommend arriving at least 15 minutes before ${eventTime}. Make sure your phone is charged to display your digital pass.`
    : `Direct Check-in: Have your mobile screen brightness turned up high. Gate stewards will scan your verified dynamic QR pass for immediate admission.`;

  const myTicketsUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/attendee/tickets`;

  const ticketListText =
    tickets.length > 0
      ? tickets.map((t) => `${t.ticketCode} (${t.ticketType || 'GA'} - Seat: ${t.seatNumber || 'GA'})`).join('\n')
      : `${booking.bookingReference} (${booking.quantity}x ${booking.ticketType})`;

  const text = `Hello ${recipientName},\n\n${is24h ? 'Your event takes place tomorrow!' : 'Your event starts in 2 hours!'}\n\nEvent: ${eventTitle}\nDate & Time: ${eventDate} • ${eventTime}\nVenue: ${eventLocation}\nBooking Reference: ${booking.bookingReference}\nTickets: ${booking.quantity}x ${booking.ticketType}\n\nIssued Passes:\n${ticketListText}\n\n${tipsText}\n\nYou can access your verified digital tickets and interactive QR passes anytime in your UTSAV dashboard:\n${myTicketsUrl}\n\nSee you there!\nThe UTSAV Platform Team`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>UTSAV Event Reminder</title>
      <style>
        body { margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #292722; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #FAF8F5; padding: 40px 16px; }
        .main-card { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E7E2DA; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #D96342 0%, #B84728 100%); padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; color: #FFFFFF; font-size: 26px; font-weight: 800; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 500; }
        .content { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #FFF7ED; color: #C2410C; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 9999px; border: 1px solid #FFEDD5; margin-bottom: 12px; letter-spacing: 0.5px; }
        .title { margin: 0 0 8px; font-size: 22px; font-weight: 800; color: #1C1917; }
        .lead { margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #57534E; }
        .event-card { background-color: #FAF8F5; border: 1px solid #E7E2DA; border-radius: 14px; padding: 20px; margin: 20px 0; }
        .event-title { font-size: 18px; font-weight: 800; color: #1C1917; margin: 0 0 12px; }
        .meta-row { margin-bottom: 8px; font-size: 13px; color: #57534E; }
        .meta-label { font-weight: 700; color: #1C1917; display: inline-block; min-width: 120px; }
        .tips-box { background-color: #FFF8F5; border: 1px solid #F3D5CC; border-radius: 12px; padding: 16px; margin: 24px 0; font-size: 12px; line-height: 1.6; color: #8C3E26; }
        .btn-container { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background-color: #D96342; color: #FFFFFF !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 12px; box-shadow: 0 2px 8px rgba(217, 99, 66, 0.25); }
        .footer { padding: 24px 28px; background-color: #FAF8F5; border-top: 1px solid #E7E2DA; text-align: center; font-size: 11px; color: #A8A29E; line-height: 1.6; }
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
            <div class="badge">${bannerBadge}</div>
            <h2 class="title">${heading}</h2>
            <p class="lead">${leadText}</p>

            <div class="event-card">
              <div class="event-title">${eventTitle}</div>
              <div class="meta-row">
                <span class="meta-label">📅 Date & Time:</span>
                <span><strong>${eventDate}</strong> • ${eventTime}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">📍 Venue:</span>
                <span>${eventLocation}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">🎟️ Booking Ref:</span>
                <span style="font-family:monospace;font-weight:700;">${booking.bookingReference}</span>
              </div>
              <div class="meta-row" style="margin-bottom:0;">
                <span class="meta-label">🏷️ Passes:</span>
                <span>${booking.quantity}x ${booking.ticketType || 'General Admission'}</span>
              </div>
            </div>

            <div class="tips-box">
              💡 <strong>Admission & Entry Advice:</strong><br/>
              ${tipsText}
            </div>

            <div class="btn-container">
              <a href="${myTicketsUrl}" class="btn" target="_blank" rel="noopener noreferrer">
                Access Digital Passes in My Tickets
              </a>
            </div>
          </div>
          <div class="footer">
            <p style="margin:0 0 6px;">Questions about this event? Contact support at <strong>${fromEmail}</strong>.</p>
            <p style="margin:0;">&copy; 2026 UTSAV Platform. India's Curated Event Discovery & Ticketing Platform.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: recipient,
    subject,
    text,
    html,
  });
};

/**
 * Safely triggers an event reminder email with atomic concurrency lock
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.bookingId
 * @param {'24h'|'2h'} params.reminderType
 * @returns {Promise<{ success: boolean, delivered?: boolean, skipped?: boolean, reason?: string, error?: string, messageId?: string }>}
 */
export const sendReminderEmailForBooking = async (arg1, arg2 = '24h') => {
  const isObj = typeof arg1 === 'object' && arg1 !== null && !arg1._bsontype;
  const bookingId = isObj ? (arg1.bookingId || arg1.id) : arg1;
  const reminderType = (isObj ? arg1.reminderType : arg2) || '24h';

  if (!bookingId) return { success: false, error: 'No booking ID provided' };

  const is24h = reminderType === '24h';
  const queryField = is24h ? 'reminder24hSent' : 'reminder2hSent';
  const statusField = is24h ? 'reminder24hStatus' : 'reminder2hStatus';
  const sentAtField = is24h ? 'reminder24hSentAt' : 'reminder2hSentAt';
  const msgIdField = is24h ? 'reminder24hMessageId' : 'reminder2hMessageId';
  const errorField = is24h ? 'reminder24hError' : 'reminder2hError';

  try {
    const existing = await Booking.findById(bookingId).populate('eventId');
    if (!existing) {
      return { success: false, error: 'Booking not found' };
    }

    if (existing.status !== 'confirmed') {
      return { success: true, skipped: true, reason: 'booking_not_confirmed' };
    }

    if (existing[queryField] === true) {
      return { success: true, skipped: true, reason: 'already_sent' };
    }

    // Atomic concurrency lock
    const claimed = await Booking.findOneAndUpdate(
      {
        _id: bookingId,
        status: 'confirmed',
        [queryField]: { $ne: true },
        [statusField]: { $ne: 'processing' },
      },
      {
        $set: { [statusField]: 'processing' },
      },
      { new: true }
    ).populate('eventId');

    if (!claimed) {
      return { success: true, skipped: true, reason: 'concurrency_lock' };
    }

    const [user, tickets] = await Promise.all([
      User.findById(claimed.userId),
      Ticket.find({ bookingId: claimed._id, status: { $ne: 'cancelled' } }),
    ]);

    const attendeeRecord = user || {
      name: claimed.attendeeName,
      email: claimed.attendeeEmail,
    };

    const emailResult = await sendEventReminderEmail({
      booking: claimed,
      event: claimed.eventId,
      user: attendeeRecord,
      reminderType,
      tickets,
    });

    claimed[queryField] = true;
    claimed[sentAtField] = new Date();
    claimed[statusField] = 'sent';
    claimed[msgIdField] =
      emailResult?.messageId || (emailResult?.simulated ? 'SIMULATED' : 'DELIVERED');
    claimed[errorField] = '';
    await claimed.save();

    console.log(`✅ [${reminderType} Reminder Email] Dispatched for ${claimed.bookingReference} to ${attendeeRecord.email}`);
    return { success: true, delivered: !!emailResult?.delivered, messageId: claimed[msgIdField] };
  } catch (err) {
    console.error(`⚠️ [${reminderType} Reminder Error] Booking ${bookingId}:`, err.message);
    try {
      await Booking.findByIdAndUpdate(bookingId, {
        $set: {
          [statusField]: 'failed',
          [errorField]: err.message,
        },
      });
    } catch (saveErr) {
      // ignore
    }
    return { success: false, error: err.message };
  }
};

export default {
  sendEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
  sendConfirmationEmailForBooking,
  sendCancellationEmail,
  sendCancellationEmailForBooking,
  sendEventReminderEmail,
  sendReminderEmailForBooking,
  getTransporter,
  setTransporter,
};
