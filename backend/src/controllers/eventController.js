import Event from '../models/Event.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { getEventStartDateTime, getIstDateBounds } from '../utils/eventDateUtils.js';

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

    // Reference instant for start-time cutoff
    const now = req._referenceDate
      ? new Date(req._referenceDate)
      : req.query?._refDate
      ? new Date(req.query._refDate)
      : new Date();
    const bounds = getIstDateBounds(now);

    // Coarse index filter: Any event scheduled more than 48 hours before start of today IST is definitely past
    const coarseLowerBound = new Date(bounds.startOfToday.getTime() - 48 * 60 * 60 * 1000);
    let coarseUpperBound = null;

    if (date && date !== 'all' && date !== 'All Dates') {
      if (date === 'today') {
        coarseUpperBound = new Date(bounds.endOfToday.getTime() + 24 * 60 * 60 * 1000);
      } else if (date === 'this-weekend' || date === 'weekend') {
        coarseUpperBound = new Date(bounds.endOfWeekend.getTime() + 24 * 60 * 60 * 1000);
      } else if (date === 'this-week') {
        coarseUpperBound = new Date(bounds.endOfWeek.getTime() + 24 * 60 * 60 * 1000);
      } else if (date === 'this-month') {
        coarseUpperBound = new Date(bounds.endOfMonth.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    if (coarseUpperBound) {
      query.isoDate = { $gte: coarseLowerBound, $lte: coarseUpperBound };
    } else {
      query.isoDate = { $gte: coarseLowerBound };
    }

    // Fetch candidate documents matching database criteria
    const candidates = await Event.find(query);

    // Strictly evaluate candidates with getEventStartDateTime
    const eligibleEvents = [];
    for (const evt of candidates) {
      // Must be published and not cancelled
      if (evt.status !== 'published') continue;

      const startDateTime = getEventStartDateTime(evt);
      // Exclude events with missing, invalid, or ambiguous start timestamps
      if (!startDateTime || isNaN(startDateTime.getTime())) continue;

      // Exclude events whose actual start instant is at or before current time
      if (startDateTime.getTime() <= now.getTime()) continue;

      // Strict IST date filters
      if (date && date !== 'all' && date !== 'All Dates') {
        if (date === 'today') {
          if (
            startDateTime.getTime() < bounds.startOfToday.getTime() ||
            startDateTime.getTime() > bounds.endOfToday.getTime()
          ) {
            continue;
          }
        } else if (date === 'this-weekend' || date === 'weekend') {
          if (
            startDateTime.getTime() < bounds.startOfWeekend.getTime() ||
            startDateTime.getTime() > bounds.endOfWeekend.getTime()
          ) {
            continue;
          }
        } else if (date === 'this-week') {
          if (
            startDateTime.getTime() < bounds.startOfWeek.getTime() ||
            startDateTime.getTime() > bounds.endOfWeek.getTime()
          ) {
            continue;
          }
        } else if (date === 'this-month') {
          if (
            startDateTime.getTime() < bounds.startOfMonth.getTime() ||
            startDateTime.getTime() > bounds.endOfMonth.getTime()
          ) {
            continue;
          }
        } else if (date === 'upcoming') {
          // Already verified startDateTime > now
        }
      }

      eligibleEvents.push({ doc: evt, startDateTime });
    }

    // Sorting
    eligibleEvents.sort((a, b) => {
      if (sort === 'latest') {
        return b.startDateTime.getTime() - a.startDateTime.getTime();
      }
      if (sort === 'price-low') {
        const diff = (a.doc.priceNumber || 0) - (b.doc.priceNumber || 0);
        return diff !== 0 ? diff : a.startDateTime.getTime() - b.startDateTime.getTime();
      }
      if (sort === 'price-high') {
        const diff = (b.doc.priceNumber || 0) - (a.doc.priceNumber || 0);
        return diff !== 0 ? diff : a.startDateTime.getTime() - b.startDateTime.getTime();
      }
      if (sort === 'popular') {
        const diff = (a.doc.spotsLeft || 0) - (b.doc.spotsLeft || 0);
        return diff !== 0 ? diff : a.startDateTime.getTime() - b.startDateTime.getTime();
      }
      if (sort === 'newest') {
        return new Date(b.doc.createdAt || 0).getTime() - new Date(a.doc.createdAt || 0).getTime();
      }
      if (sort === 'rating' || sort === 'top-rated') {
        const diff = (b.doc.averageRating || 0) - (a.doc.averageRating || 0);
        return diff !== 0 ? diff : (b.doc.reviewCount || 0) - (a.doc.reviewCount || 0);
      }
      // Default: 'soonest'
      return a.startDateTime.getTime() - b.startDateTime.getTime();
    });

    const total = eligibleEvents.length;
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const totalPages = Math.ceil(total / pageLimit) || 1;
    const skip = (currentPage - 1) * pageLimit;
    const paginatedEvents = eligibleEvents.slice(skip, skip + pageLimit).map((item) => item.doc);

    res.status(200).json({
      success: true,
      count: paginatedEvents.length,
      total,
      page: currentPage,
      pages: totalPages,
      events: paginatedEvents,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get real published category event counts for upcoming events
 * @route   GET /api/events/categories
 * @access  Public
 */
export const getEventCategories = async (req, res, next) => {
  try {
    const now = req._referenceDate
      ? new Date(req._referenceDate)
      : req.query?._refDate
      ? new Date(req.query._refDate)
      : new Date();
    const bounds = getIstDateBounds(now);
    const coarseLowerBound = new Date(bounds.startOfToday.getTime() - 48 * 60 * 60 * 1000);

    const events = await Event.find({
      status: 'published',
      isoDate: { $gte: coarseLowerBound },
    }).select('category isoDate time status');

    const countMap = {};
    for (const evt of events) {
      if (evt.status !== 'published') continue;
      const startDateTime = getEventStartDateTime(evt);
      if (!startDateTime || isNaN(startDateTime.getTime())) continue;
      if (startDateTime.getTime() <= now.getTime()) continue;
      if (evt.category) {
        countMap[evt.category] = (countMap[evt.category] || 0) + 1;
      }
    }

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
