import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';

/**
 * @desc    Get all tickets belonging to the authenticated attendee
 * @route   GET /api/tickets/my-tickets
 * @access  Private (Attendee / User)
 */
export const getMyTickets = async (req, res, next) => {
  try {
    const { status = 'valid' } = req.query;

    const query = { userId: req.user._id };
    if (status && ['valid', 'checked_in', 'cancelled', 'all'].includes(status)) {
      if (status !== 'all') {
        query.status = status;
      }
    }

    const tickets = await Ticket.find(query)
      .populate(
        'eventId',
        'title tagline date time city venue price image format category isoDate organizer'
      )
      .populate('bookingId', 'bookingReference status paymentStatus totalAmount createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tickets.length,
      tickets,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single ticket details with verified QR code (Strict ownership enforced)
 * @route   GET /api/tickets/:id
 * @access  Private (Ticket Owner or Admin)
 */
export const getTicketById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID format.',
      });
    }

    const ticket = await Ticket.findById(id)
      .populate('eventId', 'title tagline date time city venue price image format category')
      .populate('bookingId', 'bookingReference status paymentStatus');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    // Strict ownership verification
    const isOwner = ticket.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to access another attendee’s ticket pass.',
      });
    }

    res.status(200).json({
      success: true,
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Check-in ticket via QR payload or ticket code (Organizer/Admin verification)
 * @route   POST /api/tickets/check-in
 * @access  Private (Organizer of the event, or Admin)
 */
export const checkInTicket = async (req, res, next) => {
  try {
    const { ticketCode, qrData } = req.body;
    let code = ticketCode;

    if (!code && qrData) {
      try {
        const parsed = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
        code = parsed.tkt;
      } catch (e) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: 'Invalid QR code payload format.',
        });
      }
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Ticket code or QR payload is required for check-in.',
      });
    }

    const ticket = await Ticket.findOne({ ticketCode: code.toUpperCase().trim() }).populate('eventId');
    if (!ticket) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: 'Ticket pass not found in UTSAV registry.',
      });
    }

    // Authorization: Only the event organizer or an admin can check in attendees
    const isEventOrganizer = ticket.eventId?.organizerId?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isEventOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        valid: false,
        message: 'Forbidden: You are not authorized to check in attendees for this event.',
      });
    }

    // Invalidation Check: Cancelled tickets cannot be checked in
    if (ticket.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        valid: false,
        status: 'cancelled',
        message: 'Check-in rejected: This ticket has been cancelled and deactivated.',
      });
    }

    // Duplicate Check: Already checked in
    if (ticket.status === 'checked_in') {
      return res.status(400).json({
        success: false,
        valid: false,
        status: 'checked_in',
        message: `Check-in rejected: This ticket was already checked in at ${new Date(ticket.checkedInAt).toLocaleTimeString()}.`,
      });
    }

    ticket.status = 'checked_in';
    ticket.checkedInAt = new Date();
    await ticket.save();

    res.status(200).json({
      success: true,
      valid: true,
      status: 'checked_in',
      message: `Pass verified! ${ticket.attendeeName} checked in for ${ticket.ticketType}.`,
      ticket,
    });
  } catch (error) {
    next(error);
  }
};
