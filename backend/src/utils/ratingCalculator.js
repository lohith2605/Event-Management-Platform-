import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Event from '../models/Event.js';
import logger from './logger.js';

/**
 * Re-aggregates genuine ratings from published/flagged reviews and persists
 * averageRating and reviewCount on the Event document.
 * Excludes moderated 'hidden' reviews.
 *
 * @param {string|mongoose.Types.ObjectId} eventId
 * @returns {Promise<{ averageRating: number, reviewCount: number }>}
 */
export const recalculateEventRating = async (eventId) => {
  if (!eventId) return { averageRating: 0, reviewCount: 0 };

  try {
    const rawId = eventId?._id ? eventId._id : eventId;
    const objectId = typeof rawId === 'string' ? new mongoose.Types.ObjectId(rawId) : rawId;

    const stats = await Review.aggregate([
      {
        $match: {
          eventId: objectId,
          status: { $ne: 'hidden' },
        },
      },
      {
        $group: {
          _id: '$eventId',
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]);

    const averageRating =
      stats.length > 0 && stats[0].averageRating != null
        ? parseFloat(stats[0].averageRating.toFixed(1))
        : 0;
    const reviewCount = stats.length > 0 ? stats[0].reviewCount : 0;

    await Event.findByIdAndUpdate(objectId, {
      averageRating,
      reviewCount,
    });

    logger.info(`Recalculated event ratings for ${objectId}: average=${averageRating}, count=${reviewCount}`);
    return { averageRating, reviewCount };
  } catch (error) {
    logger.error(`Error recalculating event ratings for ${eventId}:`, error);
    return { averageRating: 0, reviewCount: 0 };
  }
};
