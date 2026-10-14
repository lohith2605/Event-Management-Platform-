import User from '../models/User.js';
import Event from '../models/Event.js';

/**
 * @desc    Get real administrative platform metrics
 * @route   GET /api/admin/stats
 * @access  Private (Admin only)
 */
export const getAdminStats = async (req, res, next) => {
  try {
    const [totalUsers, totalAttendees, totalOrganizers, totalEvents, publishedEvents] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'attendee' }),
        User.countDocuments({ role: 'organizer' }),
        Event.countDocuments(),
        Event.countDocuments({ status: 'published' }),
      ]);

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalAttendees,
        totalOrganizers,
        totalEvents,
        publishedEvents,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
