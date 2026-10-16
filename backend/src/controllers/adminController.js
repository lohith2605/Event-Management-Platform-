import mongoose from 'mongoose';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Booking from '../models/Booking.js';
import Ticket from '../models/Ticket.js';
import Review from '../models/Review.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import Coupon from '../models/Coupon.js';
import CouponRedemption from '../models/CouponRedemption.js';
import { sendCancellationEmailForBooking } from '../services/emailService.js';
import { processRazorpayRefund, fetchRazorpayRefund } from '../services/refundService.js';
import { processEventReminders } from '../services/reminderScheduler.js';
import {
  createAndEmitNotification,
  notifyOrganizerEventApproved,
  notifyOrganizerEventRejected,
  notifyAttendeesOfPublishedEvent,
  notifyAttendeeBookingCancelled,
} from '../services/notificationService.js';
import { recalculateEventRating } from '../utils/ratingCalculator.js';

/**
 * Helper to record administrative audit log
 */
const recordAuditLog = async ({
  req,
  action,
  targetType,
  targetId,
  targetTitle = '',
  details = '',
  reason = '',
  metadata = {},
}) => {
  try {
    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '';

    await AuditLog.create({
      adminId: req.user._id,
      adminEmail: req.user.email,
      adminName: req.user.name,
      action,
      targetType,
      targetId: targetId ? targetId.toString() : 'system',
      targetTitle: targetTitle.substring(0, 200),
      details: details.substring(0, 500),
      reason: reason.substring(0, 500),
      metadata,
      ipAddress,
    });
  } catch (err) {
    console.error('Failed to create audit log entry:', err.message);
  }
};

/**
 * @desc    Get real administrative platform metrics
 * @route   GET /api/admin/stats
 * @access  Private (Admin only)
 */
export const getAdminStats = async (req, res, next) => {
  try {
    // 1. User metrics
    const [
      totalUsers,
      totalAttendees,
      totalOrganizers,
      totalAdmins,
      suspendedUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'attendee' }),
      User.countDocuments({ role: 'organizer' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ isSuspended: true }),
    ]);

    // 2. Event metrics
    const [
      totalEvents,
      publishedEvents,
      pendingEvents,
      rejectedEvents,
      draftEvents,
      cancelledEvents,
    ] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ status: 'published' }),
      Event.countDocuments({ status: 'pending' }),
      Event.countDocuments({ status: 'rejected' }),
      Event.countDocuments({ status: 'draft' }),
      Event.countDocuments({ status: 'cancelled' }),
    ]);

    // 3. Booking & Financial metrics from actual records
    const [
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      pendingBookings,
      financialAggregates,
      paymentStatusCounts,
    ] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'confirmed' }),
      Booking.countDocuments({ status: 'cancelled' }),
      Booking.countDocuments({ status: 'pending' }),
      Booking.aggregate([
        {
          $group: {
            _id: null,
            grossVolume: {
              $sum: {
                $cond: [{ $ne: ['$status', 'cancelled'] }, '$totalAmount', 0],
              },
            },
            completedPaymentsVolume: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'confirmed'] },
                      {
                        $in: ['$paymentStatus', ['completed', 'free']],
                      },
                    ],
                  },
                  '$totalAmount',
                  0,
                ],
              },
            },
            refundedVolume: {
              $sum: {
                $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, '$totalAmount', 0],
              },
            },
            totalTicketsSold: {
              $sum: {
                $cond: [{ $eq: ['$status', 'confirmed'] }, '$quantity', 0],
              },
            },
          },
        },
      ]),
      Booking.aggregate([
        { $group: { _id: '$paymentStatus', count: { $sum: 1 } } },
      ]),
    ]);

    const financialData = financialAggregates[0] || {
      grossVolume: 0,
      completedPaymentsVolume: 0,
      refundedVolume: 0,
      totalTicketsSold: 0,
    };

    const paymentBreakdown = {
      free: 0,
      pending: 0,
      completed: 0,
      failed: 0,
      refunded: 0,
    };
    paymentStatusCounts.forEach((item) => {
      if (item._id && paymentBreakdown[item._id] !== undefined) {
        paymentBreakdown[item._id] = item.count;
      }
    });

    const netAmount = Math.max(0, financialData.grossVolume - financialData.refundedVolume);

    // 4. Review counts
    const [totalReviews, flaggedReviews, hiddenReviews] = await Promise.all([
      Review.countDocuments(),
      Review.countDocuments({ status: 'flagged' }),
      Review.countDocuments({ status: 'hidden' }),
    ]);

    // 5. Recent pending events (up to 5 awaiting review)
    const recentPendingEvents = await Event.find({ status: 'pending' })
      .select('title category organizer date city price format createdAt spotsLeft totalCapacity')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // 6. Recent bookings (up to 5)
    const recentBookings = await Booking.find()
      .populate('eventId', 'title')
      .select('bookingReference attendeeName totalAmount quantity status paymentStatus createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // 7. Recent audit logs (up to 6)
    const recentAuditLogs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    res.status(200).json({
      success: true,
      stats: {
        users: {
          totalUsers,
          totalAttendees,
          totalOrganizers,
          totalAdmins,
          suspendedUsers,
          activeUsers: totalUsers - suspendedUsers,
        },
        events: {
          totalEvents,
          publishedEvents,
          pendingEvents,
          rejectedEvents,
          draftEvents,
          cancelledEvents,
        },
        bookings: {
          totalBookings,
          confirmedBookings,
          cancelledBookings,
          pendingBookings,
          totalTicketsSold: financialData.totalTicketsSold,
          paymentBreakdown,
        },
        finances: {
          grossVolume: financialData.grossVolume,
          completedPaymentsVolume: financialData.completedPaymentsVolume,
          refundedVolume: financialData.refundedVolume,
          netAmount,
          currency: 'INR',
        },
        reviews: {
          totalReviews,
          flaggedReviews,
          hiddenReviews,
        },
        // Backwards compatibility shortcuts for legacy components
        totalUsers,
        totalAttendees,
        totalOrganizers,
        totalEvents,
        publishedEvents,
        pendingEvents,
        timestamp: new Date().toISOString(),
      },
      recentPendingEvents,
      recentBookings,
      recentAuditLogs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all events with filters, search, and pagination
 * @route   GET /api/admin/events
 * @access  Private (Admin only)
 */
export const getAdminEvents = async (req, res, next) => {
  try {
    const {
      status = 'all',
      category,
      format,
      search,
      page = 1,
      limit = 10,
      sort = 'newest',
    } = req.query;

    const query = {};

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Category filter
    if (category && category !== 'all' && category !== 'All Categories') {
      query.category = category.trim();
    }

    // Format filter
    if (format && format !== 'all' && format !== 'All Formats') {
      query.format = format.trim();
    }

    // Search filter across title, organizer, city, venue
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: regex },
        { organizer: regex },
        { city: regex },
        { venue: regex },
        { tagline: regex },
      ];
    }

    // Sorting
    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'event-date') {
      sortOption = { isoDate: 1 };
    } else if (sort === 'title') {
      sortOption = { title: 1 };
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (currentPage - 1) * pageLimit;

    const [events, total, statusAggregates] = await Promise.all([
      Event.find(query)
        .populate('organizerId', 'name email phone avatar isSuspended')
        .sort(sortOption)
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      Event.countDocuments(query),
      Event.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const statusCounts = {
      all: 0,
      pending: 0,
      published: 0,
      rejected: 0,
      draft: 0,
      cancelled: 0,
    };

    statusAggregates.forEach((item) => {
      if (item._id && statusCounts[item._id] !== undefined) {
        statusCounts[item._id] = item.count;
      }
      statusCounts.all += item.count;
    });

    res.status(200).json({
      success: true,
      count: events.length,
      total,
      page: currentPage,
      pages: Math.ceil(total / pageLimit) || 1,
      events,
      statusCounts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get pending events awaiting moderation (dedicated convenience endpoint)
 * @route   GET /api/admin/events/pending
 * @access  Private (Admin only)
 */
export const getPendingEvents = async (req, res, next) => {
  try {
    const events = await Event.find({ status: 'pending' })
      .populate('organizerId', 'name email phone bio isSuspended')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single event full details for admin moderation
 * @route   GET /api/admin/events/:id
 * @access  Private (Admin only)
 */
export const getAdminEventById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID format.',
      });
    }

    const event = await Event.findById(id)
      .populate('organizerId', 'name email phone bio city avatar createdAt isSuspended')
      .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    // Fetch booking statistics for this event
    const [totalBookings, confirmedBookings, ticketsSold, reviewCount] = await Promise.all([
      Booking.countDocuments({ eventId: event._id }),
      Booking.countDocuments({ eventId: event._id, status: 'confirmed' }),
      Booking.aggregate([
        { $match: { eventId: event._id, status: 'confirmed' } },
        { $group: { _id: null, total: { $sum: '$quantity' } } },
      ]),
      Review.countDocuments({ eventId: event._id }),
    ]);

    const bookingStats = {
      totalBookings,
      confirmedBookings,
      ticketsSold: ticketsSold[0]?.total || 0,
      reviewCount,
    };

    res.status(200).json({
      success: true,
      event,
      bookingStats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Review submitted event: approve, reject, or return for corrections
 * @route   PUT /api/admin/events/:id/review
 * @access  Private (Admin only)
 */
export const reviewEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    if (!['approve', 'reject', 'return'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be 'approve', 'reject', or 'return'.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID format.',
      });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    const previousStatus = event.status;

    if (action === 'approve') {
      event.status = 'published';
      event.rejectionReason = '';

      // Notify organizer and eligible attendees in real time via Socket.IO & MongoDB
      await notifyOrganizerEventApproved(event);
      await notifyAttendeesOfPublishedEvent(event);

      // Audit log
      await recordAuditLog({
        req,
        action: 'event_approved',
        targetType: 'Event',
        targetId: event._id,
        targetTitle: event.title,
        details: `Approved event "${event.title}" from status '${previousStatus}' to 'published'.`,
      });
    } else if (action === 'reject') {
      if (!rejectionReason || !rejectionReason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'A detailed rejection reason is mandatory when rejecting an event submission.',
        });
      }

      const trimmedReason = rejectionReason.trim();
      event.status = 'rejected';
      event.rejectionReason = trimmedReason;

      // Notify organizer in real time via Socket.IO & MongoDB
      await notifyOrganizerEventRejected(event, trimmedReason);

      // Audit log
      await recordAuditLog({
        req,
        action: 'event_rejected',
        targetType: 'Event',
        targetId: event._id,
        targetTitle: event.title,
        reason: trimmedReason,
        details: `Rejected event "${event.title}". Reason: ${trimmedReason}`,
      });
    } else if (action === 'return') {
      if (!rejectionReason || !rejectionReason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please provide revision feedback when returning an event for corrections.',
        });
      }

      const trimmedFeedback = rejectionReason.trim();
      event.status = 'draft';
      event.rejectionReason = trimmedFeedback;

      // Notify organizer in real time via Socket.IO & MongoDB
      await createAndEmitNotification({
        userId: event.organizerId,
        title: 'Event Returned for Corrections',
        message: `Your event "${event.title}" was returned for adjustments. Feedback: ${trimmedFeedback}`,
        type: 'event_returned',
        link: '/organizer/events',
        metadata: { eventId: event._id, action: 'return', feedback: trimmedFeedback },
      });

      // Audit log
      await recordAuditLog({
        req,
        action: 'event_returned',
        targetType: 'Event',
        targetId: event._id,
        targetTitle: event.title,
        reason: trimmedFeedback,
        details: `Returned event "${event.title}" to draft for corrections. Feedback: ${trimmedFeedback}`,
      });
    }

    await event.save();

    res.status(200).json({
      success: true,
      message:
        action === 'approve'
          ? 'Event successfully approved and published for public discovery.'
          : action === 'reject'
          ? 'Event has been rejected with the stated reason.'
          : 'Event has been returned to the organizer as a draft for corrections.',
      event,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all users with search, pagination, and role/status filtering
 * @route   GET /api/admin/users
 * @access  Private (Admin only)
 */
export const getAdminUsers = async (req, res, next) => {
  try {
    const {
      role = 'all',
      status = 'all',
      search,
      page = 1,
      limit = 10,
      sort = 'newest',
    } = req.query;

    const query = {};

    // Role filter
    if (role && role !== 'all') {
      query.role = role.toLowerCase().trim();
    }

    // Account status filter
    if (status === 'suspended') {
      query.isSuspended = true;
    } else if (status === 'active') {
      query.isSuspended = false;
    }

    // Search filter across name and email
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { email: regex }];
    }

    // Sorting
    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'name') {
      sortOption = { name: 1 };
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (currentPage - 1) * pageLimit;

    const [users, total, roleAggregates] = await Promise.all([
      User.find(query)
        .select('-password -resetPasswordToken -resetPasswordExpire')
        .sort(sortOption)
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      User.countDocuments(query),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
    ]);

    const roleCounts = {
      all: 0,
      attendee: 0,
      organizer: 0,
      admin: 0,
    };

    roleAggregates.forEach((item) => {
      if (item._id && roleCounts[item._id] !== undefined) {
        roleCounts[item._id] = item.count;
      }
      roleCounts.all += item.count;
    });

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page: currentPage,
      pages: Math.ceil(total / pageLimit) || 1,
      users,
      roleCounts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user details with activity summary
 * @route   GET /api/admin/users/:id
 * @access  Private (Admin only)
 */
export const getAdminUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
      });
    }

    const user = await User.findById(id)
      .select('-password -resetPasswordToken -resetPasswordExpire')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    let activitySummary = {};

    if (user.role === 'organizer') {
      const [eventsList, statusCounts, totalBookings] = await Promise.all([
        Event.find({ organizerId: user._id })
          .select('title status date city price format spotsLeft totalCapacity createdAt')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        Event.aggregate([
          { $match: { organizerId: new mongoose.Types.ObjectId(user._id) } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Booking.countDocuments({
          eventId: {
            $in: await Event.find({ organizerId: user._id }).distinct('_id'),
          },
        }),
      ]);

      const counts = { total: 0, published: 0, pending: 0, rejected: 0, draft: 0, cancelled: 0 };
      statusCounts.forEach((c) => {
        if (c._id && counts[c._id] !== undefined) counts[c._id] = c.count;
        counts.total += c.count;
      });

      activitySummary = {
        role: 'organizer',
        events: eventsList,
        eventCounts: counts,
        totalBookingsReceived: totalBookings,
      };
    } else {
      const [bookingsList, totalBookings, confirmedBookings, totalReviews] = await Promise.all([
        Booking.find({ userId: user._id })
          .populate('eventId', 'title date venue city')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        Booking.countDocuments({ userId: user._id }),
        Booking.countDocuments({ userId: user._id, status: 'confirmed' }),
        Review.countDocuments({ userId: user._id }),
      ]);

      activitySummary = {
        role: 'attendee',
        recentBookings: bookingsList,
        totalBookings,
        confirmedBookings,
        totalReviews,
      };
    }

    res.status(200).json({
      success: true,
      user,
      activitySummary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Suspend or reactivate user account
 * @route   PUT /api/admin/users/:id/status
 * @access  Private (Admin only)
 */
export const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason = '' } = req.body;

    if (!['suspend', 'reactivate'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be 'suspend' or 'reactivate'.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
      });
    }

    // Guard against self-lockout
    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'Security safeguard: You cannot suspend your own administrative account.',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    // Guard against suspending the last active administrator
    if (user.role === 'admin' && action === 'suspend') {
      const activeAdminCount = await User.countDocuments({
        role: 'admin',
        isSuspended: false,
      });

      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message:
            'Security safeguard: Cannot suspend the last remaining active system administrator.',
        });
      }
    }

    const trimmedReason = reason?.trim() || '';

    if (action === 'suspend') {
      user.isSuspended = true;
      user.suspensionReason = trimmedReason || 'Administrative suspension by system operator.';

      await user.save();

      // Audit log
      await recordAuditLog({
        req,
        action: 'user_suspended',
        targetType: 'User',
        targetId: user._id,
        targetTitle: `${user.name} (${user.email})`,
        reason: user.suspensionReason,
        details: `Suspended account for user "${user.name}" [${user.role}].`,
      });

      // Notification
      await createAndEmitNotification({
        userId: user._id,
        title: 'Account Suspended',
        message: `Your account has been suspended by an administrator. Reason: ${user.suspensionReason}`,
        type: 'system',
        link: '/attendee',
        metadata: { action: 'suspend', reason: user.suspensionReason },
      });
    } else {
      user.isSuspended = false;
      user.suspensionReason = '';

      await user.save();

      // Audit log
      await recordAuditLog({
        req,
        action: 'user_reactivated',
        targetType: 'User',
        targetId: user._id,
        targetTitle: `${user.name} (${user.email})`,
        reason: trimmedReason || 'Account reactivated by administrator.',
        details: `Reactivated account for user "${user.name}" [${user.role}].`,
      });

      // Notification
      await createAndEmitNotification({
        userId: user._id,
        title: 'Account Reactivated',
        message: 'Your UTSAV account has been successfully reactivated. Full access has been restored.',
        type: 'system',
        link: user.role === 'organizer' ? '/organizer/dashboard' : '/attendee',
        metadata: { action: 'reactivate' },
      });
    }

    res.status(200).json({
      success: true,
      message: `User account has been successfully ${action === 'suspend' ? 'suspended' : 'reactivated'}.`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isSuspended: user.isSuspended,
        suspensionReason: user.suspensionReason,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all bookings with pagination, search, and status filters
 * @route   GET /api/admin/bookings
 * @access  Private (Admin only)
 */
export const getAdminBookings = async (req, res, next) => {
  try {
    const {
      status = 'all',
      paymentStatus = 'all',
      search,
      page = 1,
      limit = 10,
      eventId,
    } = req.query;

    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (paymentStatus && paymentStatus !== 'all') {
      query.paymentStatus = paymentStatus;
    }

    if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
      query.eventId = eventId;
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
    const pageLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (currentPage - 1) * pageLimit;

    const [bookings, total, aggregates] = await Promise.all([
      Booking.find(query)
        .populate('eventId', 'title date venue city price priceNumber format')
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      Booking.countDocuments(query),
      Booking.aggregate([
        {
          $group: {
            _id: null,
            totalBookingsCount: { $sum: 1 },
            confirmedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] },
            },
            cancelledCount: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
            totalRevenue: {
              $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, '$totalAmount', 0] },
            },
            totalRefunded: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, '$totalAmount', 0] },
            },
          },
        },
      ]),
    ]);

    const stats = aggregates[0] || {
      totalBookingsCount: total,
      confirmedCount: 0,
      cancelledCount: 0,
      totalRevenue: 0,
      totalRefunded: 0,
    };

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page: currentPage,
      pages: Math.ceil(total / pageLimit) || 1,
      bookings,
      stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single booking with associated tickets
 * @route   GET /api/admin/bookings/:id
 * @access  Private (Admin only)
 */
export const getAdminBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format.',
      });
    }

    const booking = await Booking.findById(id)
      .populate('eventId', 'title date venue city price priceNumber format organizer isoDate spotsLeft totalCapacity')
      .populate('userId', 'name email phone avatar')
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
      });
    }

    const tickets = await Ticket.find({ bookingId: booking._id }).lean();

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
 * @desc    Cancel booking and process refund with inventory restoration
 * @route   POST /api/admin/bookings/:id/cancel-refund
 * @access  Private (Admin only)
 */
export const cancelAndRefundBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'Administrative cancellation and refund' } = req.body;

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

    // Idempotency check: Repeated cancellation requests must not re-process
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This booking is already cancelled.',
      });
    }

    const trimmedReason = (reason || '').trim() || 'Administrative cancellation and refund';

    // 1. Concurrency-safe inventory restoration
    await Event.findByIdAndUpdate(booking.eventId, {
      $inc: { spotsLeft: booking.quantity },
    });

    // 2. Mark booking cancelled and record audit attributes
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = trimmedReason;
    booking.cancelledBy = req.user._id;

    // 3. Deactivate all associated tickets
    await Ticket.updateMany(
      { bookingId: booking._id },
      { status: 'cancelled' }
    );

    // If booking utilized a coupon, adjust redemption status and restore count
    if (booking.couponId) {
      try {
        const redemption = await CouponRedemption.findOne({
          bookingId: booking._id,
          status: 'completed',
        });

        if (redemption) {
          redemption.status = 'refunded';
          await redemption.save();

          await Coupon.findOneAndUpdate(
            { _id: booking.couponId, redemptionCount: { $gt: 0 } },
            { $inc: { redemptionCount: -1 } }
          );
        }
      } catch (couponRefundErr) {
        console.error('Failed to update coupon usage on admin refund:', couponRefundErr.message);
      }
    }

    // 4. Process Refund according to payment state and method
    const isPaid =
      (booking.paymentStatus === 'completed' || booking.paymentStatus === 'refunded') &&
      booking.totalAmount > 0;
    const hasRazorpayPayment = !!booking.razorpayPaymentId;

    if (isPaid && hasRazorpayPayment) {
      // Initiate verified Razorpay refund
      const refundResult = await processRazorpayRefund({
        paymentId: booking.razorpayPaymentId,
        amount: booking.totalAmount, // Server-validated amount, never trusting client
        bookingRef: booking.bookingReference,
        reason: trimmedReason,
        adminId: req.user._id,
      });

      if (refundResult.success) {
        booking.refundStatus = refundResult.status; // 'processed' or 'initiated'
        booking.razorpayRefundId = refundResult.refundId || '';
        booking.refundAmount = refundResult.amount || booking.totalAmount;
        booking.refundReason = trimmedReason;
        booking.refundError = '';

        if (refundResult.status === 'processed') {
          booking.paymentStatus = 'refunded';
          booking.refundedAt = new Date();
        } else {
          // If refund is 'pending'/'initiated' at provider, keep paymentStatus as completed until cleared
          booking.paymentStatus = 'completed';
        }
      } else {
        // Refund initiation failed at provider
        booking.refundStatus = 'failed';
        booking.refundError = refundResult.error || 'Payment gateway refund failed';
        booking.refundAmount = booking.totalAmount;
        booking.refundReason = trimmedReason;
      }
    } else if (booking.totalAmount === 0 || booking.paymentStatus === 'free') {
      // Free event bookings require no financial refund
      booking.refundStatus = 'not_applicable';
      booking.paymentStatus = 'free';
      booking.refundAmount = 0;
      booking.refundReason = 'Free pass cancellation';
    } else {
      // Unpaid or expired hold bookings
      booking.refundStatus = 'none';
      booking.paymentStatus = 'failed';
      booking.refundAmount = 0;
      booking.refundReason = trimmedReason;
    }

    await booking.save();

    // 5. In-app Notification for attendee in real-time via Socket.IO
    try {
      await notifyAttendeeBookingCancelled(
        booking,
        { title: booking.bookingReference },
        trimmedReason
      );
    } catch (notifErr) {
      console.warn('Failed to create in-app notification:', notifErr.message);
    }

    // 6. Audit Log
    await recordAuditLog({
      req,
      action: 'booking_cancelled_refunded',
      targetType: 'Booking',
      targetId: booking._id,
      targetTitle: booking.bookingReference,
      reason: trimmedReason,
      details: `Admin cancelled booking ${booking.bookingReference} (${booking.quantity} passes, ₹${booking.totalAmount}). Refund Status: ${booking.refundStatus}.`,
      metadata: {
        refundStatus: booking.refundStatus,
        refundAmount: booking.refundAmount,
        razorpayRefundId: booking.razorpayRefundId,
      },
    });

    // 7. Dispatch Automated Attendee Cancellation & Refund Email (Non-blocking)
    const emailResult = await sendCancellationEmailForBooking(booking._id);

    res.status(200).json({
      success: true,
      message: `Booking ${booking.bookingReference} has been cancelled. Inventory restored and cancellation notification dispatched.`,
      booking,
      refundStatus: booking.refundStatus,
      cancellationEmailDispatched: !!emailResult.success,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reconcile asynchronous refund status with Razorpay
 * @route   POST /api/admin/bookings/:id/sync-refund
 * @access  Private (Admin only)
 */
export const reconcileBookingRefund = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format.',
      });
    }

    const booking = await Booking.findById(id).populate('eventId');
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
      });
    }

    if (!booking.razorpayRefundId) {
      return res.status(400).json({
        success: false,
        message: 'No Razorpay refund reference recorded for this booking.',
      });
    }

    const refundCheck = await fetchRazorpayRefund(booking.razorpayRefundId);
    if (!refundCheck.success) {
      return res.status(500).json({
        success: false,
        message: `Failed to fetch refund status from provider: ${refundCheck.error}`,
      });
    }

    const previousRefundStatus = booking.refundStatus;
    booking.refundStatus = refundCheck.status;

    if (refundCheck.status === 'processed') {
      booking.paymentStatus = 'refunded';
      booking.refundedAt = booking.refundedAt || new Date();
    } else if (refundCheck.status === 'failed') {
      booking.refundError = 'Refund marked as failed by payment provider.';
    }

    await booking.save();

    await recordAuditLog({
      req,
      action: 'refund_status_reconciled',
      targetType: 'Booking',
      targetId: booking._id,
      targetTitle: booking.bookingReference,
      details: `Reconciled refund status for ${booking.bookingReference}: '${previousRefundStatus}' -> '${refundCheck.status}'.`,
    });

    res.status(200).json({
      success: true,
      message: `Refund status reconciled: ${refundCheck.status}`,
      booking,
      refundStatus: booking.refundStatus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get reviews with moderation status filter and search
 * @route   GET /api/admin/reviews
 * @access  Private (Admin only)
 */
export const getAdminReviews = async (req, res, next) => {
  try {
    const {
      status = 'all',
      rating,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (rating && Number(rating) >= 1 && Number(rating) <= 5) {
      query.rating = Number(rating);
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ comment: regex }, { attendeeName: regex }];
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (currentPage - 1) * pageLimit;

    const [reviews, total, statusAggregates] = await Promise.all([
      Review.find(query)
        .populate('eventId', 'title date venue city image')
        .populate('userId', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      Review.countDocuments(query),
      Review.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const statusCounts = {
      all: 0,
      published: 0,
      flagged: 0,
      hidden: 0,
    };

    statusAggregates.forEach((item) => {
      const key = item._id || 'published';
      if (statusCounts[key] !== undefined) {
        statusCounts[key] = item.count;
      }
      statusCounts.all += item.count;
    });

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      page: currentPage,
      pages: Math.ceil(total / pageLimit) || 1,
      reviews,
      statusCounts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Moderate review: publish, flag, or hide
 * @route   PUT /api/admin/reviews/:id/moderate
 * @access  Private (Admin only)
 */
export const moderateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason = '' } = req.body;

    if (!['publish', 'flag', 'hide'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be 'publish', 'flag', or 'hide'.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID format.',
      });
    }

    const review = await Review.findById(id).populate('eventId', 'title');
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.',
      });
    }

    const targetStatus = action === 'publish' ? 'published' : action === 'flag' ? 'flagged' : 'hidden';
    const trimmedReason = reason?.trim() || '';

    review.status = targetStatus;
    review.moderationReason = trimmedReason;
    await review.save();

    // Recalculate event ratings immediately based on actual active reviews
    await recalculateEventRating(review.eventId);

    // Audit log
    await recordAuditLog({
      req,
      action: 'review_moderated',
      targetType: 'Review',
      targetId: review._id,
      targetTitle: `Review by ${review.attendeeName}`,
      reason: trimmedReason,
      details: `Set review moderation status to '${targetStatus}'.`,
    });

    res.status(200).json({
      success: true,
      message: `Review moderation status updated to '${targetStatus}'.`,
      review,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get audit logs with search, action, and target filters
 * @route   GET /api/admin/audit-logs
 * @access  Private (Admin only)
 */
export const getAdminAuditLogs = async (req, res, next) => {
  try {
    const {
      action = 'all',
      targetType = 'all',
      search,
      page = 1,
      limit = 15,
    } = req.query;

    const query = {};

    if (action && action !== 'all') {
      query.action = action;
    }

    if (targetType && targetType !== 'all') {
      query.targetType = targetType;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { adminEmail: regex },
        { adminName: regex },
        { targetTitle: regex },
        { details: regex },
        { reason: regex },
      ];
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (currentPage - 1) * pageLimit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      page: currentPage,
      pages: Math.ceil(total / pageLimit) || 1,
      logs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get admin notifications
 * @route   GET /api/admin/notifications
 * @access  Private (Admin only)
 */
export const getAdminNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark single notification as read
 * @route   PUT /api/admin/notifications/:id/read
 * @access  Private (Admin only)
 */
export const markAdminNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark all admin notifications as read
 * @route   PUT /api/admin/notifications/read-all
 * @access  Private (Admin only)
 */
export const markAllAdminNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Manually trigger automated event reminders check
 * @route   POST /api/admin/reminders/trigger
 * @access  Private (Admin only)
 */
export const triggerRemindersCheck = async (req, res, next) => {
  try {
    const { referenceTime } = req.body;
    const stats = await processEventReminders({
      referenceTime: referenceTime ? new Date(referenceTime) : undefined,
    });

    await recordAuditLog({
      req,
      action: 'TRIGGER_REMINDERS',
      targetType: 'system',
      targetId: null,
      targetTitle: 'Automated Event Reminders',
      details: `Admin triggered event reminder check. Stats: 24h: ${stats.sent24h}, 2h: ${stats.sent2h}, checked: ${stats.checkedEvents}`,
      reason: 'Manual scheduler invocation',
      metadata: stats,
    });

    res.status(200).json({
      success: true,
      message: 'Event reminder processing completed successfully.',
      stats,
    });
  } catch (error) {
    next(error);
  }
};
