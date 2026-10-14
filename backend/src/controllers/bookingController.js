import crypto from 'crypto';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Ticket from '../models/Ticket.js';
import Event from '../models/Event.js';
import Notification from '../models/Notification.js';

/**
 * Generate secure HMAC signature for QR ticket
 */
const generateTicketSignature = (ticketCode, eventId, bookingRef) => {
  const secret = process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform';
  return crypto
    .createHmac('sha256', secret)
    .update(`${ticketCode}:${eventId}:${bookingRef}`)
    .digest('hex')
    .substring(0, 16);
};

/**
 * @desc    Create a new booking (Free instant confirm or Paid pending gateway)
 * @route   POST /api/bookings
 * @access  Private (Attendee / Organizer / Admin)
 */
export const createBooking = async (req, res, next) => {
  try {
    const { eventId, quantity = 1, ticketType = 'General Admission', notes = '' } = req.body;

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing event ID.',
      });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1 || qty > 10) {
      return res.status(400).json({
        success: false,
        message: 'Please choose between 1 and 10 tickets per booking.',
      });
    }

    // Check if event exists and is published
    const existingEvent = await Event.findById(eventId);
    if (!existingEvent || existingEvent.status !== 'published') {
      return res.status(404).json({
        success: false,
        message: 'This event is either unpublished or no longer available for booking.',
      });
    }

    // Concurrency-safe atomic inventory reservation
    // Only decrements if remaining spotsLeft >= requested quantity
    const updatedEvent = await Event.findOneAndUpdate(
      { _id: eventId, spotsLeft: { $gte: qty }, status: 'published' },
      { $inc: { spotsLeft: -qty } },
      { new: true }
    );

    if (!updatedEvent) {
      return res.status(400).json({
        success: false,
        message: `Sorry, there are not enough tickets available. Remaining spots: ${existingEvent.spotsLeft}.`,
      });
    }

    const isFree = updatedEvent.priceNumber === 0;
    const unitPrice = updatedEvent.priceNumber || 0;
    const totalAmount = unitPrice * qty;

    const bookingReference = `UTSAV-BK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Free events are immediately confirmed with real passes
    // Paid events are set to 'pending' because live payment gateway credentials are not yet configured
    const bookingStatus = isFree ? 'confirmed' : 'pending';
    const paymentStatus = isFree ? 'free' : 'pending';
    const paymentMethod = isFree ? 'free_pass' : 'gateway_pending';

    const booking = await Booking.create({
      bookingReference,
      userId: req.user._id,
      eventId: updatedEvent._id,
      ticketType: ticketType || 'General Admission',
      quantity: qty,
      unitPrice,
      totalAmount,
      currency: 'INR',
      status: bookingStatus,
      paymentStatus,
      paymentMethod,
      attendeeName: req.user.name,
      attendeeEmail: req.user.email,
      attendeePhone: req.user.phone || '',
      notes: notes.trim(),
    });

    let tickets = [];

    if (isFree) {
      // Issue authentic tickets with secure QR payloads
      const ticketDocs = [];
      for (let i = 1; i <= qty; i++) {
        const ticketCode = `UTSAV-TKT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const signature = generateTicketSignature(ticketCode, updatedEvent._id, bookingReference);

        // Safe QR data: ticket identifier, event reference, booking reference, and HMAC verification signature
        // NEVER contains JWT, session secrets, card data, or sensitive personal data
        const qrPayload = JSON.stringify({
          app: 'UTSAV',
          tkt: ticketCode,
          ref: bookingReference,
          evt: updatedEvent._id.toString(),
          seat: qty > 1 ? `GA-${i}` : 'GA',
          sig: signature,
        });

        ticketDocs.push({
          ticketCode,
          bookingId: booking._id,
          bookingReference,
          eventId: updatedEvent._id,
          userId: req.user._id,
          attendeeName: req.user.name,
          ticketType: ticketType || 'General Admission',
          seatNumber: qty > 1 ? `GA-${i}` : 'GA',
          qrData: qrPayload,
          status: 'valid',
        });
      }

      tickets = await Ticket.insertMany(ticketDocs);

      // Create booking confirmation notification
      await Notification.create({
        userId: req.user._id,
        title: 'Booking Confirmed!',
        message: `Your booking for "${updatedEvent.title}" (${qty} pass${qty > 1 ? 'es' : ''}) is confirmed. Digital passes are ready in My Tickets.`,
        type: 'booking_confirmed',
        link: '/attendee/tickets',
        metadata: { bookingReference, eventId: updatedEvent._id },
      });
    } else {
      // Create pending payment notification for paid booking
      await Notification.create({
        userId: req.user._id,
        title: 'Booking Reserved (Payment Pending)',
        message: `Your booking reservation ${bookingReference} for "${updatedEvent.title}" is saved. Complete payment when gateway checkout is available.`,
        type: 'system',
        link: '/attendee/bookings',
        metadata: { bookingReference, eventId: updatedEvent._id },
      });
    }

    res.status(201).json({
      success: true,
      message: isFree
        ? 'Booking confirmed successfully! Your tickets are ready.'
        : 'Booking reserved. Paid gateway checkout is currently pending live credentials.',
      booking,
      tickets,
      event: {
        id: updatedEvent._id,
        title: updatedEvent.title,
        date: updatedEvent.date,
        time: updatedEvent.time,
        venue: updatedEvent.venue,
        spotsLeft: updatedEvent.spotsLeft,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all bookings for the authenticated attendee
 * @route   GET /api/bookings/my-bookings
 * @access  Private (Authenticated User)
 */
export const getMyBookings = async (req, res, next) => {
  try {
    const { status } = req.query;

    const query = { userId: req.user._id };
    if (status && ['confirmed', 'pending', 'cancelled'].includes(status)) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate(
        'eventId',
        'title tagline category date time city venue price priceNumber image format isoDate spotsLeft'
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single booking by ID (Strict ownership enforced)
 * @route   GET /api/bookings/:id
 * @access  Private (Booking Owner or Admin)
 */
export const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format.',
      });
    }

    const booking = await Booking.findById(id).populate(
      'eventId',
      'title tagline category date time city venue price priceNumber image format organizer isoDate'
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
      });
    }

    // Strict ownership verification
    const isOwner = booking.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view another attendee’s booking.',
      });
    }

    // Fetch associated tickets
    const tickets = await Ticket.find({ bookingId: booking._id });

    res.status(200).json({
      success: true,
      booking,
      tickets,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel a confirmed booking with inventory rollback
 * @route   POST /api/bookings/:id/cancel
 * @access  Private (Booking Owner)
 */
export const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'Cancelled by attendee' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format.',
      });
    }

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
      });
    }

    // Strict ownership verification
    if (booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot cancel another attendee’s booking.',
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This booking is already cancelled.',
      });
    }

    // Concurrency-safe inventory restoration
    await Event.findByIdAndUpdate(booking.eventId, {
      $inc: { spotsLeft: booking.quantity },
    });

    // Update booking record
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason.trim();
    if (booking.paymentStatus === 'free') {
      booking.paymentStatus = 'refunded';
    }
    await booking.save();

    // Deactivate associated tickets
    await Ticket.updateMany(
      { bookingId: booking._id },
      { status: 'cancelled' }
    );

    // Notify attendee
    await Notification.create({
      userId: req.user._id,
      title: 'Booking Cancelled',
      message: `Your booking ${booking.bookingReference} has been cancelled and tickets have been deactivated.`,
      type: 'booking_cancelled',
      link: '/attendee/bookings',
      metadata: { bookingReference: booking.bookingReference },
    });

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully. Inventory spots have been restored.',
      booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get genuine dashboard overview metrics for logged-in attendee
 * @route   GET /api/bookings/overview-stats
 * @access  Private (Authenticated User)
 */
export const getAttendeeStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Direct aggregation from real MongoDB records - zero fabricated metrics
    const [totalBookings, confirmedBookings, activeTickets, unreadNotifications] =
      await Promise.all([
        Booking.countDocuments({ userId }),
        Booking.countDocuments({ userId, status: 'confirmed' }),
        Ticket.countDocuments({ userId, status: 'valid' }),
        Notification.countDocuments({ userId, isRead: false }),
      ]);

    // Fetch upcoming bookings with populated event details
    const upcomingBookings = await Booking.find({
      userId,
      status: 'confirmed',
    })
      .populate('eventId', 'title date time city venue price image format isoDate')
      .sort({ createdAt: -1 })
      .limit(3);

    res.status(200).json({
      success: true,
      stats: {
        totalBookings,
        confirmedBookings,
        activeTickets,
        unreadNotifications,
      },
      upcomingBookings,
    });
  } catch (error) {
    next(error);
  }
};
