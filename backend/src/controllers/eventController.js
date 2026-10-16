import Event from '../models/Event.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

/**
 * @desc    Get published upcoming events with filtering, search, and pagination
 * @route   GET /api/events
 * @access  Public
 */
export const getPublishedEvents = async (req, res, next) => {
  try {
    const {
      search,
      q,
      category,
      city,
      format,
      pricing,
      price,
      featured,
      date,
      sort = 'soonest',
      page = 1,
      limit = 12,
    } = req.query;

    const searchTerm = search || q;
    const priceFilter = pricing || price;

    // Strict security: Only return published events for public discovery
    const query = { status: 'published' };

    // 1. Text Search across title, tagline, venue, and organizer
    if (searchTerm && searchTerm.trim()) {
      const escaped = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { title: regex },
        { tagline: regex },
        { venue: regex },
        { organizer: regex },
        { tags: regex },
      ];
    }

    // 2. Category Filter (Case-insensitive match, matches single-word or compound category names)
    if (category && category !== 'All' && category !== 'All Categories') {
      const cleanCat = category.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.category = new RegExp(cleanCat, 'i');
    }

    // 3. City Filter (Ignore 'All' or 'All Cities')
    if (city && city !== 'All' && city !== 'All Cities') {
      query.city = city.trim();
    }

    // 4. Format Filter ('In-Person', 'Online', 'Hybrid')
    if (format && format !== 'All' && format !== 'All Formats') {
      query.format = format.trim();
    }

    // 5. Pricing Filter
    if (priceFilter === 'free') {
      query.priceNumber = 0;
    } else if (priceFilter === 'paid') {
      query.priceNumber = { $gt: 0 };
    }

    // 6. Featured filter
    if (featured === 'true' || featured === true) {
      query.isFeatured = true;
    }

    // 7. Date Filter ('today', 'this-weekend', 'this-week', 'this-month', 'upcoming')
    if (date && date !== 'all' && date !== 'All Dates') {
      const now = new Date();
      if (date === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        query.isoDate = { $gte: startOfDay, $lte: endOfDay };
      } else if (date === 'this-weekend' || date === 'weekend') {
        const currentDay = now.getDay(); // 0 is Sunday, 5 is Friday, 6 is Saturday
        const daysToFriday = (5 - currentDay + 7) % 7;
        const weekendStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (currentDay === 6 ? -1 : currentDay === 0 ? -2 : daysToFriday), 0, 0, 0);
        const daysToSunday = (7 - currentDay) % 7;
        const weekendEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToSunday, 23, 59, 59, 999);
        query.isoDate = { $gte: weekendStart, $lte: weekendEnd };
      } else if (date === 'this-week') {
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - now.getDay()), 23, 59, 59, 999);
        query.isoDate = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (date === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        query.isoDate = { $gte: startOfMonth, $lte: endOfMonth };
      } else if (date === 'upcoming') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        query.isoDate = { $gte: startOfToday };
      }
    }

    // Sorting
    let sortOptions = { isoDate: 1 }; // Default: Soonest first
    if (sort === 'latest') {
      sortOptions = { isoDate: -1 };
    } else if (sort === 'price-low') {
      sortOptions = { priceNumber: 1, isoDate: 1 };
    } else if (sort === 'price-high') {
      sortOptions = { priceNumber: -1, isoDate: 1 };
    } else if (sort === 'popular') {
      sortOptions = { spotsLeft: 1, isoDate: 1 };
    } else if (sort === 'newest') {
      sortOptions = { createdAt: -1 };
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (currentPage - 1) * pageLimit;

    const [events, total] = await Promise.all([
      Event.find(query).sort(sortOptions).skip(skip).limit(pageLimit),
      Event.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: events.length,
      total,
      page: currentPage,
      pages: Math.ceil(total / pageLimit) || 1,
      events,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get real published category event counts
 * @route   GET /api/events/categories
 * @access  Public
 */
export const getEventCategories = async (req, res, next) => {
  try {
    const counts = await Event.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    counts.forEach((item) => {
      if (item._id) countMap[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      categories: countMap,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single event by ID
 * @route   GET /api/events/:id
 * @access  Public
 */
export const getEventById = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event || event.status !== 'published') {
      return res.status(404).json({
        success: false,
        message: 'Event not found or has been unpublished.',
      });
    }

    res.status(200).json({
      success: true,
      event,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get events authored by the authenticated organizer
 * @route   GET /api/events/organizer/my-events
 * @access  Private (Organizer / Admin)
 */
export const getOrganizerEvents = async (req, res, next) => {
  try {
    const query = req.user.role === 'admin' ? {} : { organizerId: req.user._id };

    const events = await Event.find(query).sort({ createdAt: -1 });

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
 * @desc    Create a new genuine event
 * @route   POST /api/events
 * @access  Private (Organizer / Admin)
 */
export const createEvent = async (req, res, next) => {
  try {
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
      isFeatured,
      tags,
      spotsLeft,
      totalCapacity,
      format,
    } = req.body;

    if (!title || !category || !date || !isoDate || !city || !venue) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: title, category, date, isoDate, city, and venue.',
      });
    }

    const event = await Event.create({
      title,
      tagline,
      description,
      category,
      date,
      isoDate: new Date(isoDate),
      time: time || '10:00 AM IST',
      city,
      venue,
      price: price || 'Free',
      priceNumber: Number(priceNumber) || 0,
      image:
        image ||
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
      organizer: req.user.name,
      organizerId: req.user._id,
      isFeatured: !!isFeatured,
      tags: Array.isArray(tags) ? tags : [],
      spotsLeft: Number(spotsLeft) || 100,
      totalCapacity: Number(totalCapacity) || 500,
      format: format || 'In-Person',
      status: req.user.role === 'admin' ? (req.body.status || 'published') : 'pending',
    });

    // Notify admins if event is awaiting approval
    if (event.status === 'pending') {
      try {
        const admins = await User.find({ role: 'admin' }).select('_id');
        const notifDocs = admins.map((admin) => ({
          userId: admin._id,
          title: 'New Event Awaiting Approval',
          message: `Organizer "${req.user.name}" submitted "${event.title}" for review.`,
          type: 'admin_alert',
          link: `/admin?tab=events&eventId=${event._id}`,
          metadata: { eventId: event._id, organizerId: req.user._id },
        }));
        if (notifDocs.length > 0) {
          await Notification.insertMany(notifDocs);
        }
      } catch (e) {
        console.warn('Failed to dispatch admin notification:', e.message);
      }
    }

    res.status(201).json({
      success: true,
      event,
    });
  } catch (error) {
    next(error);
  }
};
