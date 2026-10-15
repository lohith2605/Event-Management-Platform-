import crypto from 'crypto';
import Ticket from '../models/Ticket.js';

/**
 * Generate secure HMAC signature for QR ticket payload
 */
export const generateTicketSignature = (ticketCode, eventId, bookingRef) => {
  const secret = process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform';
  return crypto
    .createHmac('sha256', secret)
    .update(`${ticketCode}:${eventId}:${bookingRef}`)
    .digest('hex')
    .substring(0, 16);
};

/**
 * Issues authentic tickets with secure HMAC QR payloads for a confirmed booking.
 * Idempotent: If tickets already exist for this booking, returns existing tickets.
 */
export const issueTicketsForBooking = async (booking, event, user) => {
  // Idempotency check: Never issue duplicate tickets
  const existingTickets = await Ticket.find({ bookingId: booking._id });
  if (existingTickets.length > 0) {
    return existingTickets;
  }

  const qty = booking.quantity || 1;
  const ticketDocs = [];

  for (let i = 1; i <= qty; i++) {
    const ticketCode = `UTSAV-TKT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const signature = generateTicketSignature(ticketCode, event._id, booking.bookingReference);

    // Safe QR payload: verified ticket code, booking reference, event ID, seat, and HMAC signature
    // Never contains JWT, session tokens, or sensitive financial data
    const qrPayload = JSON.stringify({
      app: 'UTSAV',
      tkt: ticketCode,
      ref: booking.bookingReference,
      evt: event._id.toString(),
      seat: qty > 1 ? `GA-${i}` : 'GA',
      sig: signature,
    });

    ticketDocs.push({
      ticketCode,
      bookingId: booking._id,
      bookingReference: booking.bookingReference,
      eventId: event._id,
      userId: user?._id || booking.userId,
      attendeeName: user?.name || booking.attendeeName,
      ticketType: booking.ticketType || 'General Admission',
      seatNumber: qty > 1 ? `GA-${i}` : 'GA',
      qrData: qrPayload,
      status: 'valid',
    });
  }

  return await Ticket.insertMany(ticketDocs);
};
