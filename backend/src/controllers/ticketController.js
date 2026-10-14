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
