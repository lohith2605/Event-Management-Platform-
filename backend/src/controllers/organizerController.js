import mongoose from 'mongoose';
import Event from '../models/Event.js';
import Booking from '../models/Booking.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { handleEventRescheduled } from '../services/reminderScheduler.js';

/**
 * Helper to ensure the authenticated user owns the event, or is an admin.
 */
const verifyEventOwnership = async (eventId, user) => {
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return { error: 'Invalid event ID format', status: 400 };
  }

  const event = await Event.findById(eventId);
  if (!event) {
    return { error: 'Event not found', status: 404 };
  }

  const isOwner = event.organizerId && event.organizerId.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return {
      error: 'Forbidden: You do not have permission to manage this event.',
      status: 403,
    };
  }

  return { event };
};

/**
 * @desc    Get real organizer overview metrics and recent activity
 * @route   GET /api/organizer/overview
 * @access  Private (Organizer / Admin)
 */
export const getOrganizerOverview = async (req, res, next) => {
  try {
    const isRootAdmin = req.user.role === 'admin' && req.query.scope === 'all';
    const eventFilter = isRootAdmin ? {} : { organizerId: req.user._id };

    // 1. Fetch all events authored by this organizer
    const organizerEvents = await Event.find(eventFilter)
      .select('_id title date isoDate city venue status price priceNumber spotsLeft totalCapacity image')
      .sort({ isoDate: 1 })
      .lean();

    const eventIds = organizerEvents.map((e) => e._id);

    // Event status counts
    const totalEvents = organizerEvents.length;
    const publishedEvents = organizerEvents.filter((e) => e.status === 'published').length;
    const pendingEvents = organizerEvents.filter((e) => e.status === 'pending').length;
    const rejectedEvents = organizerEvents.filter((e) => e.status === 'rejected').length;
    const cancelledEvents = organizerEvents.filter((e) => e.status === 'cancelled').length;
    const draftEvents = organizerEvents.filter((e) => e.status === 'draft').length;

    // Upcoming events (filter future or soonest dates)
    const now = new Date();
    const upcomingEvents = organizerEvents
      .filter((e) => e.isoDate && new Date(e.isoDate) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
      .slice(0, 5);

    // 2. Fetch bookings strictly scoped to this organizer's event IDs
    let totalBookings = 0;
    let confirmedBookings = 0;
    let totalAttendees = 0;
    let totalRevenue = 0;
    let recentBookings = [];

    if (eventIds.length > 0) {
      const [bookingStats, rawRecentBookings] = await Promise.all([
        Booking.aggregate([
          { $match: { eventId: { $in: eventIds } } },
          {
            $group: {
              _id: null,
              totalBookings: { $sum: 1 },
              confirmedBookings: {
                $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] },
              },
              totalAttendees: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'confirmed'] }, '$quantity', 0],
                },
              },
              // Phase 8 rule: Revenue from successful payments only.
              // Count only when paymentStatus === 'completed' or confirmed with positive amount
              confirmedRevenue: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$status', 'confirmed'] },
                        { $in: ['$paymentStatus', ['completed']] },
                      ],
                    },
                    '$totalAmount',
                    0,
                  ],
                },
              },
              // Also compute pending revenue for transparency
              pendingRevenue: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$status', 'pending'] },
                        { $gt: ['$totalAmount', 0] },
                      ],
                    },
                    '$totalAmount',
                    0,
                  ],
                },
              },
            },
          },
        ]),
        Booking.find({ eventId: { $in: eventIds } })
          .sort({ createdAt: -1 })
          .limit(6)
          .populate('eventId', 'title date venue city')
          .lean(),
      ]);

      if (bookingStats.length > 0) {
        totalBookings = bookingStats[0].totalBookings || 0;
        confirmedBookings = bookingStats[0].confirmedBookings || 0;
        totalAttendees = bookingStats[0].totalAttendees || 0;
        totalRevenue = bookingStats[0].confirmedRevenue || 0;
      }

      recentBookings = rawRecentBookings.map((b) => ({
        _id: b._id,
        bookingReference: b.bookingReference,
        eventTitle: b.eventId?.title || 'Unknown Event',
        eventId: b.eventId?._id,
        attendeeName: b.attendeeName,
        attendeeEmail: b.attendeeEmail,
        ticketType: b.ticketType,
        quantity: b.quantity,
        totalAmount: b.totalAmount,
        currency: b.currency || 'INR',
        status: b.status,
        paymentStatus: b.paymentStatus,
        createdAt: b.createdAt,
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalEvents,
          publishedEvents,
          pendingEvents,
          rejectedEvents,
          cancelledEvents,
          draftEvents,
          totalBookings,
          confirmedBookings,
          totalAttendees,
          totalRevenue,
        },
        upcomingEvents,
        recentBookings,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get organizer's events with search, filter, and pagination
 * @route   GET /api/organizer/events
 * @access  Private (Organizer / Admin)
 */
export const getOrganizerEvents = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 12 } = req.query;

    const isRootAdmin = req.user.role === 'admin' && req.query.scope === 'all';
    const query = isRootAdmin ? {} : { organizerId: req.user._id };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: regex }, { city: regex }, { venue: regex }, { category: regex }];
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (currentPage - 1) * pageLimit;

    const [events, total] = await Promise.all([
      Event.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageLimit).lean(),
      Event.countDocuments(query),
    ]);

    // Compute aggregate booking and ticket metrics per event
    const eventIds = events.map((e) => e._id);
    let bookingAggregates = {};

    if (eventIds.length > 0) {
      const aggregates = await Booking.aggregate([
        { $match: { eventId: { $in: eventIds } } },
        {
          $group: {
            _id: '$eventId',
            totalBookings: { $sum: 1 },
            confirmedTickets: {
              $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, '$quantity', 0] },
            },
            confirmedRevenue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'confirmed'] },
                      { $eq: ['$paymentStatus', 'completed'] },
                    ],
                  },
                  '$totalAmount',
                  0,
                ],
              },
            },
          },
        },
      ]);

      aggregates.forEach((agg) => {
        bookingAggregates[agg._id.toString()] = agg;
      });
    }

    const eventsWithStats = events.map((event) => {
      const agg = bookingAggregates[event._id.toString()] || {};
      return {
        ...event,
        bookingCount: agg.totalBookings || 0,
        confirmedTickets: agg.confirmedTickets || 0,
        confirmedRevenue: agg.confirmedRevenue || 0,
      };
    });

    res.status(200).json({
      success: true,
      count: eventsWithStats.length,
      total,
      page: currentPage,
      pages: Math.ceil(total / pageLimit) || 1,
      events: eventsWithStats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single event authored by organizer
 * @route   GET /api/organizer/events/:id
 * @access  Private (Organizer / Admin)
 */
export const getOrganizerEventById = async (req, res, next) => {
  try {
    const { event, error, status } = await verifyEventOwnership(req.params.id, req.user);
    if (error) {
      return res.status(status).json({ success: false, message: error });
    }

    // Get event booking metrics
    const stats = await Booking.aggregate([
      { $match: { eventId: event._id } },
      {
        $group: {
          _id: '$ticketType',
          count: { $sum: 1 },
          quantity: { $sum: '$quantity' },
          revenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'confirmed'] },
                    { $eq: ['$paymentStatus', 'completed'] },
                  ],
                },
                '$totalAmount',
                0,
              ],
            },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      event,
      tierStats: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new genuine event
 * @route   POST /api/organizer/events
 * @access  Private (Organizer / Admin)
 */
export const createOrganizerEvent = async (req, res, next) => {
  try {
    const {
      title,
      tagline = '',
      description = '',
      category,
      date,
      isoDate,
      time = '10:00 AM IST',
      city,
      venue,
      price = 'Free',
      priceNumber = 0,
      image,
      format = 'In-Person',
      totalCapacity = 500,
      spotsLeft,
      ticketTiers = [],
      tags = [],
      registrationDeadline,
      status: requestedStatus,
    } = req.body;

    // Server-side validation of mandatory fields
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Event title is required.' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Event category is required.' });
    }
    if (!date || !date.trim()) {
      return res.status(400).json({ success: false, message: 'Display date is required.' });
    }
    if (!isoDate) {
      return res.status(400).json({ success: false, message: 'Valid ISO date is required.' });
    }
    if (!city || !city.trim()) {
      return res.status(400).json({ success: false, message: 'Host city is required.' });
    }
    if (!venue || !venue.trim()) {
      return res.status(400).json({ success: false, message: 'Event venue or stream link is required.' });
    }

    const parsedIsoDate = new Date(isoDate);
    if (isNaN(parsedIsoDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid start date format.' });
    }

    // Handle ticket tiers if provided
    let normalizedTiers = [];
    let calculatedCapacity = Number(totalCapacity) || 500;
    let calculatedSpots = spotsLeft !== undefined ? Number(spotsLeft) : calculatedCapacity;

    if (Array.isArray(ticketTiers) && ticketTiers.length > 0) {
      normalizedTiers = ticketTiers.map((tier) => ({
        name: tier.name?.trim() || 'General Admission',
        price: Math.max(0, Number(tier.price) || 0),
        capacity: Math.max(1, Number(tier.capacity) || 100),
        spotsLeft: Math.max(0, Number(tier.spotsLeft ?? tier.capacity ?? 100)),
        description: tier.description?.trim() || '',
      }));

      // Calculate total capacity across all tiers
      calculatedCapacity = normalizedTiers.reduce((acc, t) => acc + t.capacity, 0);
      calculatedSpots = normalizedTiers.reduce((acc, t) => acc + t.spotsLeft, 0);
    } else {
      // Default single General Admission tier
      normalizedTiers = [
        {
          name: 'General Admission',
          price: Math.max(0, Number(priceNumber) || 0),
          capacity: calculatedCapacity,
          spotsLeft: calculatedSpots,
          description: 'Standard event access pass',
        },
      ];
    }

    // Role-based approval policy:
    // Organizers CANNOT set status to 'published' - it must be reviewed by Admin.
    // Organizers can choose 'draft' or 'pending' (default is 'pending').
    // Only Admin can set 'published' directly.
    let finalStatus = 'pending';
    if (req.user.role === 'admin') {
      finalStatus = requestedStatus || 'published';
    } else if (requestedStatus === 'draft') {
      finalStatus = 'draft';
    }

    const event = await Event.create({
      title: title.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      category: category.trim(),
      date: date.trim(),
      isoDate: parsedIsoDate,
      time: time.trim(),
      city: city.trim(),
      venue: venue.trim(),
      price: Number(priceNumber) === 0 ? 'Free' : `₹${priceNumber}`,
      priceNumber: Math.max(0, Number(priceNumber) || 0),
      image:
        image?.trim() ||
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
      organizer: req.user.name,
      organizerId: req.user._id,
      format: ['In-Person', 'Online', 'Hybrid'].includes(format) ? format : 'In-Person',
      totalCapacity: calculatedCapacity,
      spotsLeft: calculatedSpots,
      ticketTiers: normalizedTiers,
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : undefined,
      status: finalStatus,
    });

    if (finalStatus === 'pending') {
      try {
        const admins = await User.find({ role: 'admin' }).select('_id');
        const notifs = admins.map((admin) => ({
          userId: admin._id,
          title: 'New Event Awaiting Approval',
          message: `Organizer "${req.user.name}" submitted "${event.title}" for review.`,
          type: 'admin_alert',
          link: `/admin?tab=events&eventId=${event._id}`,
          metadata: { eventId: event._id, organizerId: req.user._id },
        }));
        if (notifs.length > 0) {
          await Notification.insertMany(notifs);
        }
      } catch (e) {
        console.warn('Failed to notify admins of submitted event:', e.message);
      }
    }

    res.status(201).json({
      success: true,
      message:
        finalStatus === 'pending'
          ? 'Event submitted successfully! It is now pending administrative review.'
          : 'Event created successfully.',
      event,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update organizer's own event
 * @route   PUT /api/organizer/events/:id
 * @access  Private (Organizer / Admin)
 */
export const updateOrganizerEvent = async (req, res, next) => {
  try {
    const { event, error, status } = await verifyEventOwnership(req.params.id, req.user);
    if (error) {
      return res.status(status).json({ success: false, message: error });
    }

    // Disallow editing cancelled events
    if (event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cancelled events cannot be modified. Please create a new event.',
      });
    }

    const {
      title,
      tagline,
      description,
      category,
      date,
      isoDate,
      time,
      city,
      venue,
      price,
      priceNumber,
      image,
      format,
      totalCapacity,
      ticketTiers,
      tags,
      registrationDeadline,
      status: requestedStatus,
    } = req.body;

    const previousIsoDate = event.isoDate ? new Date(event.isoDate) : null;

    if (title) event.title = title.trim();
    if (tagline !== undefined) event.tagline = tagline.trim();
    if (description !== undefined) event.description = description.trim();
    if (category) event.category = category.trim();
    if (date) event.date = date.trim();
    if (isoDate) {
      const parsed = new Date(isoDate);
      if (!isNaN(parsed.getTime())) event.isoDate = parsed;
    }
    if (time) event.time = time.trim();
    if (city) event.city = city.trim();
    if (venue) event.venue = venue.trim();
    if (priceNumber !== undefined) {
      event.priceNumber = Math.max(0, Number(priceNumber) || 0);
      event.price = event.priceNumber === 0 ? 'Free' : `₹${event.priceNumber}`;
    }
    if (image) event.image = image.trim();
    if (format && ['In-Person', 'Online', 'Hybrid'].includes(format)) {
      event.format = format;
    }
    if (registrationDeadline !== undefined) {
      event.registrationDeadline = registrationDeadline ? new Date(registrationDeadline) : null;
    }
    if (Array.isArray(tags)) {
      event.tags = tags.map((t) => String(t).trim()).filter(Boolean);
    }

    // Capacity & Tiers handling
    if (Array.isArray(ticketTiers) && ticketTiers.length > 0) {
      event.ticketTiers = ticketTiers.map((tier) => ({
        name: tier.name?.trim() || 'General Admission',
        price: Math.max(0, Number(tier.price) || 0),
        capacity: Math.max(1, Number(tier.capacity) || 100),
        spotsLeft: Math.max(0, Number(tier.spotsLeft ?? tier.capacity ?? 100)),
        description: tier.description?.trim() || '',
      }));
      event.totalCapacity = event.ticketTiers.reduce((acc, t) => acc + t.capacity, 0);
    } else if (totalCapacity !== undefined && Number(totalCapacity) > 0) {
      const newCap = Number(totalCapacity);
      // Adjust spotsLeft by capacity difference
      const diff = newCap - event.totalCapacity;
      event.totalCapacity = newCap;
      event.spotsLeft = Math.max(0, event.spotsLeft + diff);
    }

    // Status management:
    // If the event was rejected or draft, submitting an update resets status to 'pending'
    if (event.status === 'rejected' || event.status === 'draft') {
      if (requestedStatus === 'draft') {
        event.status = 'draft';
      } else {
        event.status = 'pending';
        event.rejectionReason = ''; // Clear prior rejection reason upon resubmission
      }
    } else if (req.user.role === 'admin' && requestedStatus) {
      event.status = requestedStatus;
    }

    await event.save();

    // Check if event was rescheduled to a new future time
    if (event.isoDate && previousIsoDate && event.isoDate.getTime() !== previousIsoDate.getTime()) {
      try {
        await handleEventRescheduled(event._id, event.isoDate, previousIsoDate);
      } catch (rescheduleErr) {
        console.warn('Failed to reset reminders for rescheduled event:', rescheduleErr.message);
      }
    }

    if (event.status === 'pending') {
      try {
        const admins = await User.find({ role: 'admin' }).select('_id');
        const notifs = admins.map((admin) => ({
          userId: admin._id,
          title: 'Event Resubmitted for Approval',
          message: `Organizer "${req.user.name}" updated and resubmitted "${event.title}" for review.`,
          type: 'admin_alert',
          link: `/admin?tab=events&eventId=${event._id}`,
          metadata: { eventId: event._id, organizerId: req.user._id },
        }));
        if (notifs.length > 0) {
          await Notification.insertMany(notifs);
        }
      } catch (e) {
        console.warn('Failed to notify admins of resubmitted event:', e.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Event details updated successfully.',
      event,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel an event authored by the organizer
 * @route   POST /api/organizer/events/:id/cancel
 * @access  Private (Organizer / Admin)
 */
export const cancelOrganizerEvent = async (req, res, next) => {
  try {
    const { event, error, status } = await verifyEventOwnership(req.params.id, req.user);
    if (error) {
      return res.status(status).json({ success: false, message: error });
    }

    if (event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This event has already been cancelled.',
      });
    }

    const { reason = 'Cancelled by organizer' } = req.body;

    event.status = 'cancelled';
    event.cancellationReason = reason.trim();
    await event.save();

    // Notify all attendees with confirmed bookings about the cancellation
    const bookings = await Booking.find({ eventId: event._id, status: 'confirmed' });

    if (bookings.length > 0) {
      const notifications = bookings.map((b) => ({
        userId: b.userId,
        title: `Event Cancelled: ${event.title}`,
        message: `The organizer has cancelled "${event.title}". Reason: ${reason}. Please visit My Bookings for updates.`,
        type: 'event_update',
        link: '/attendee/bookings',
        metadata: { eventId: event._id, bookingId: b._id },
      }));

      await Notification.insertMany(notifications).catch((err) =>
        console.error('Failed to dispatch cancellation notifications:', err)
      );
    }

    res.status(200).json({
      success: true,
      message: 'Event has been cancelled. Registered attendees have been notified.',
      event,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get bookings for organizer's events
 * @route   GET /api/organizer/bookings
 * @access  Private (Organizer / Admin)
 */
export const getOrganizerBookings = async (req, res, next) => {
  try {
    const { eventId, status, search, page = 1, limit = 20 } = req.query;

    const isRootAdmin = req.user.role === 'admin' && req.query.scope === 'all';
    const eventFilter = isRootAdmin ? {} : { organizerId: req.user._id };

    const myEvents = await Event.find(eventFilter).select('_id title date venue').lean();
    const myEventIds = myEvents.map((e) => e._id);

    if (myEventIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        total: 0,
        page: 1,
        pages: 1,
        bookings: [],
      });
    }

    const query = { eventId: { $in: myEventIds } };

    if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
      // Ensure the requested eventId belongs to this organizer
      const ownsEvent = myEventIds.some((id) => id.toString() === eventId);
      if (!ownsEvent && !isRootAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not own the requested event.',
        });
      }
      query.eventId = new mongoose.Types.ObjectId(eventId);
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { bookingReference: regex },
        { attendeeName: regex },
        { attendeeEmail: regex },
        { attendeePhone: regex },
      ];
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (currentPage - 1) * pageLimit;

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .populate('eventId', 'title date venue city')
        .lean(),
      Booking.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page: currentPage,
      pages: Math.ceil(total / pageLimit) || 1,
      bookings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get attendee roster for organizer's events
 * @route   GET /api/organizer/attendees
 * @access  Private (Organizer / Admin)
 */
export const getOrganizerAttendees = async (req, res, next) => {
  try {
    const { eventId, search, page = 1, limit = 25 } = req.query;

    const isRootAdmin = req.user.role === 'admin' && req.query.scope === 'all';
    const eventFilter = isRootAdmin ? {} : { organizerId: req.user._id };

    const myEvents = await Event.find(eventFilter).select('_id title date venue').lean();
    const myEventIds = myEvents.map((e) => e._id);

    if (myEventIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        total: 0,
        page: 1,
        pages: 1,
        attendees: [],
      });
    }

    const query = { eventId: { $in: myEventIds } };

    if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
      const ownsEvent = myEventIds.some((id) => id.toString() === eventId);
      if (!ownsEvent && !isRootAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not own the requested event.',
        });
      }
      query.eventId = new mongoose.Types.ObjectId(eventId);
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { attendeeName: regex },
        { attendeeEmail: regex },
        { attendeePhone: regex },
        { bookingReference: regex },
      ];
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (currentPage - 1) * pageLimit;

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .populate('eventId', 'title date venue city')
        .lean(),
      Booking.countDocuments(query),
    ]);

    const attendees = bookings.map((b) => ({
      _id: b._id,
      bookingReference: b.bookingReference,
      name: b.attendeeName,
      email: b.attendeeEmail,
      phone: b.attendeePhone || '—',
      eventTitle: b.eventId?.title || 'Unknown Event',
      eventId: b.eventId?._id,
      ticketType: b.ticketType || 'General Admission',
      quantity: b.quantity,
      bookingStatus: b.status,
      paymentStatus: b.paymentStatus,
      registeredAt: b.createdAt,
    }));

    res.status(200).json({
      success: true,
      count: attendees.length,
      total,
      page: currentPage,
      pages: Math.ceil(total / pageLimit) || 1,
      attendees,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get organizer genuine analytics
 * @route   GET /api/organizer/analytics
 * @access  Private (Organizer / Admin)
 */
export const getOrganizerAnalytics = async (req, res, next) => {
  try {
    const isRootAdmin = req.user.role === 'admin' && req.query.scope === 'all';
    const eventFilter = isRootAdmin ? {} : { organizerId: req.user._id };

    const myEvents = await Event.find(eventFilter)
      .select('_id title date isoDate status totalCapacity spotsLeft priceNumber')
      .lean();

    const myEventIds = myEvents.map((e) => e._id);

    // Event status breakdown
    const statusCounts = {
      published: myEvents.filter((e) => e.status === 'published').length,
      pending: myEvents.filter((e) => e.status === 'pending').length,
      draft: myEvents.filter((e) => e.status === 'draft').length,
      cancelled: myEvents.filter((e) => e.status === 'cancelled').length,
      rejected: myEvents.filter((e) => e.status === 'rejected').length,
    };

    const now = new Date();
    const upcomingCount = myEvents.filter(
      (e) => e.isoDate && new Date(e.isoDate) >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
    ).length;
    const completedCount = myEvents.filter(
      (e) => e.isoDate && new Date(e.isoDate) < new Date(now.getFullYear(), now.getMonth(), now.getDate())
    ).length;

    let revenueOverTime = [];
    let ticketTypeDistribution = [];
    let eventPerformance = [];
    let totalConfirmedRevenue = 0;
    let totalTicketsSold = 0;

    if (myEventIds.length > 0) {
      // 1. Revenue & Bookings over time (group by day or month)
      revenueOverTime = await Booking.aggregate([
        { $match: { eventId: { $in: myEventIds } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            bookingsCount: { $sum: 1 },
            confirmedTickets: {
              $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, '$quantity', 0] },
            },
            confirmedRevenue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'confirmed'] },
                      { $eq: ['$paymentStatus', 'completed'] },
                    ],
                  },
                  '$totalAmount',
                  0,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // 2. Ticket tier distribution
      ticketTypeDistribution = await Booking.aggregate([
        { $match: { eventId: { $in: myEventIds }, status: 'confirmed' } },
        {
          $group: {
            _id: '$ticketType',
            ticketsSold: { $sum: '$quantity' },
            revenue: {
              $sum: {
                $cond: [{ $eq: ['$paymentStatus', 'completed'] }, '$totalAmount', 0],
              },
            },
          },
        },
        { $sort: { ticketsSold: -1 } },
      ]);

      // 3. Event performance
      const perEventAgg = await Booking.aggregate([
        { $match: { eventId: { $in: myEventIds } } },
        {
          $group: {
            _id: '$eventId',
            bookings: { $sum: 1 },
            confirmedTickets: {
              $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, '$quantity', 0] },
            },
            confirmedRevenue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'confirmed'] },
                      { $eq: ['$paymentStatus', 'completed'] },
                    ],
                  },
                  '$totalAmount',
                  0,
                ],
              },
            },
          },
        },
      ]);

      const aggMap = {};
      perEventAgg.forEach((a) => {
        aggMap[a._id.toString()] = a;
        totalConfirmedRevenue += a.confirmedRevenue || 0;
        totalTicketsSold += a.confirmedTickets || 0;
      });

      eventPerformance = myEvents.map((evt) => {
        const agg = aggMap[evt._id.toString()] || {};
        const ticketsSold = agg.confirmedTickets || 0;
        const capacity = evt.totalCapacity || 100;
        const utilizationRate = capacity > 0 ? Math.min(100, Math.round((ticketsSold / capacity) * 100)) : 0;

        return {
          eventId: evt._id,
          title: evt.title,
          status: evt.status,
          totalCapacity: capacity,
          spotsLeft: evt.spotsLeft,
          ticketsSold,
          utilizationRate,
          confirmedRevenue: agg.confirmedRevenue || 0,
        };
      });
    }

    res.status(200).json({
      success: true,
      analytics: {
        summary: {
          totalEvents: myEvents.length,
          upcomingCount,
          completedCount,
          totalTicketsSold,
          totalConfirmedRevenue,
        },
        statusCounts,
        revenueOverTime,
        ticketTypeDistribution,
        eventPerformance,
      },
    });
  } catch (error) {
    next(error);
  }
};
