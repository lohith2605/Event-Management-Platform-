import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import Event from '../models/Event.js';
import { hasEventEnded, getEventEndDateTime } from '../utils/eventDateUtils.js';
import { recalculateEventRating } from '../utils/ratingCalculator.js';

/**
 * @desc    Get published/active reviews for an event with dynamic database-calculated average & count
 * @route   GET /api/reviews/event/:eventId
 * @access  Public
 */
export const getEventReviews = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID format.',
      });
    }

    const reviews = await Review.find({
      eventId,
      status: { $ne: 'hidden' },
    })
      .select('userId eventId rating comment attendeeName createdAt updatedAt status')
      .sort({ createdAt: -1 })
      .lean();

    const total = reviews.length;
    const averageRating =
      total > 0
        ? parseFloat((reviews.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(1))
        : 0;

    res.status(200).json({
      success: true,
      count: total,
      averageRating,
      reviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Check if authenticated attendee is eligible to review an event
 * @route   GET /api/reviews/event/:eventId/eligibility
 * @access  Private (Attendee)
 */
export const getEventReviewEligibility = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID format.',
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    // 1. Check if event has ended
    const eventEnded = hasEventEnded(event);
    const endDateTime = getEventEndDateTime(event);

    // 2. Check confirmed booking
    const confirmedBooking = await Booking.findOne({
      userId: req.user._id,
      eventId,
      status: 'confirmed',
    }).select('_id bookingReference createdAt');

    // 3. Check existing review
    const existingReview = await Review.findOne({
      userId: req.user._id,
      eventId,
    }).lean();

    let eligible = true;
    let reason = '';

    if (!confirmedBooking) {
      eligible = false;
      reason = 'You can only review events you have booked and confirmed on UTSAV.';
    } else if (!eventEnded) {
      eligible = false;
      reason = `Reviews will open after the event concludes on ${event.date || 'the scheduled date'}.`;
    }

    res.status(200).json({
      success: true,
      eligible,
      reason,
      eventEnded,
      endDateTime,
      hasConfirmedBooking: !!confirmedBooking,
      booking: confirmedBooking,
      existingReview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get reviews written by the authenticated attendee
 * @route   GET /api/reviews/my-reviews
 * @access  Private (Attendee)
 */
export const getMyReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ userId: req.user._id })
      .populate('eventId', 'title date venue city image status endDate isoDate time')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit or update review for an event (Enforces booking eligibility, event conclusion, and single review constraint)
 * @route   POST /api/reviews
 * @access  Private (Attendee)
 */
export const createOrUpdateReview = async (req, res, next) => {
  try {
    const { eventId, rating, comment = '' } = req.body;

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid event ID.',
      });
    }

    const numericRating = Number(rating);
    if (!numericRating || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid star rating between 1 and 5.',
      });
    }

    const sanitizedComment = typeof comment === 'string' ? comment.trim() : '';
    if (sanitizedComment.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Review comment cannot exceed 1000 characters.',
      });
    }

    // Verify event exists and status is valid
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    if (!['published', 'completed'].includes(event.status)) {
      return res.status(400).json({
        success: false,
        message: `Reviews are not permitted for events with status '${event.status}'.`,
      });
    }

    // Requirement 2: Allow reviewing only after the actual event end date and time
    if (!hasEventEnded(event)) {
      const endDateTime = getEventEndDateTime(event);
      return res.status(400).json({
        success: false,
        message: `Reviews are only allowed after the event has concluded (scheduled end: ${endDateTime ? endDateTime.toISOString() : event.date}).`,
      });
    }

    // Requirement 1 & 8: Attendee must have a confirmed booking
    const confirmedBooking = await Booking.findOne({
      userId: req.user._id,
      eventId,
      status: 'confirmed',
    });

    if (!confirmedBooking) {
      return res.status(403).json({
        success: false,
        message: 'Eligibility requirement: You can only review events you have a confirmed booking for on UTSAV.',
      });
    }

    // Requirement 4 & 5: Single review per attendee per event with seamless creation/editing
    const review = await Review.findOneAndUpdate(
      { userId: req.user._id, eventId },
      {
        rating: numericRating,
        comment: sanitizedComment,
        attendeeName: req.user.name || 'UTSAV Attendee',
        status: 'published',
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    // Requirement 6 & 11: Recalculate event averages and review count from database
    const updatedStats = await recalculateEventRating(eventId);

    res.status(200).json({
      success: true,
      message: 'Review saved successfully.',
      review,
      eventStats: updatedStats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update an existing review with strict ownership verification
 * @route   PUT /api/reviews/:id
 * @access  Private (Attendee)
 */
export const updateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, comment = '' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID format.',
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.',
      });
    }

    // Requirement 5: Ownership verified on the backend
    if (review.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only edit your own reviews.',
      });
    }

    const numericRating = Number(rating);
    if (!numericRating || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid star rating between 1 and 5.',
      });
    }

    const sanitizedComment = typeof comment === 'string' ? comment.trim() : '';
    if (sanitizedComment.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Review comment cannot exceed 1000 characters.',
      });
    }

    review.rating = numericRating;
    review.comment = sanitizedComment;
    review.attendeeName = req.user.name || review.attendeeName;
    await review.save();

    // Recalculate event averages and review count
    const updatedStats = await recalculateEventRating(review.eventId);

    res.status(200).json({
      success: true,
      message: 'Review updated successfully.',
      review,
      eventStats: updatedStats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a review with ownership verification
 * @route   DELETE /api/reviews/:id
 * @access  Private (Attendee or Admin)
 */
export const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID format.',
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.',
      });
    }

    const isOwner = review.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only delete your own reviews.',
      });
    }

    const eventId = review.eventId;
    await Review.findByIdAndDelete(id);

    // Recalculate event averages and review count
    const updatedStats = await recalculateEventRating(eventId);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully.',
      eventStats: updatedStats,
    });
  } catch (error) {
    next(error);
  }
};
