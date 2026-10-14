import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import Event from '../models/Event.js';

/**
 * @desc    Get published reviews for an event
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

    const reviews = await Review.find({ eventId }).sort({ createdAt: -1 });

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
 * @desc    Get reviews written by the authenticated attendee
 * @route   GET /api/reviews/my-reviews
 * @access  Private
 */
export const getMyReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ userId: req.user._id })
      .populate('eventId', 'title date venue city image')
      .sort({ createdAt: -1 });

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
 * @desc    Submit or update review for an event (Enforces booking eligibility and single-review rule)
 * @route   POST /api/reviews
 * @access  Private (Attendee)
 */
export const createOrUpdateReview = async (req, res, next) => {
  try {
    const { eventId, rating, comment } = req.body;

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid event ID.',
      });
    }

    const numericRating = Number(rating);
    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a rating between 1 and 5 stars.',
      });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide written feedback for your review.',
      });
    }

    // Verify event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    // Strict Eligibility Check: Attendee must have a confirmed booking for this event
    const confirmedBooking = await Booking.findOne({
      userId: req.user._id,
      eventId,
      status: 'confirmed',
    });

    if (!confirmedBooking) {
      return res.status(403).json({
        success: false,
        message:
          'Eligibility requirement: You can only review events you have a confirmed booking for on UTSAV.',
      });
    }

    // Upsert to permit one active review per attendee per event with seamless editing
    const review = await Review.findOneAndUpdate(
      { userId: req.user._id, eventId },
      {
        rating: numericRating,
        comment: comment.trim(),
        attendeeName: req.user.name,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    res.status(200).json({
      success: true,
      message: 'Review saved successfully.',
      review,
    });
  } catch (error) {
    next(error);
  }
};
