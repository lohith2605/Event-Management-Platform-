import mongoose from 'mongoose';
import Event from '../models/Event.js';
import Booking from '../models/Booking.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

/**
 * Checks whether an attendee holds a valid, qualifying booking for an event.
 * Excludes cancelled, failed, expired, or refunded bookings.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string|mongoose.Types.ObjectId} eventId
 * @returns {Promise<boolean>}
 */
export const hasQualifyingBooking = async (userId, eventId) => {
  if (!userId || !eventId) return false;

  const qualifyingBooking = await Booking.findOne({
    userId,
    eventId,
    status: 'confirmed',
    paymentStatus: { $nin: ['failed', 'refunded'] },
    refundStatus: { $ne: 'processed' },
  }).lean();

  return Boolean(qualifyingBooking);
};

/**
 * Verifies whether the authenticated user is authorized to participate in a conversation.
 * Enforces event approval rules, ownership rules, and attendee booking requirements.
 *
 * @param {Object} user - The authenticated user document/object (req.user or socket.user)
 * @param {Object} conversation - The conversation document
 * @returns {Promise<{ allowed: boolean, status?: number, message?: string, event?: Object }>}
 */
export const verifyConversationAccess = async (user, conversation) => {
  if (!user || !user._id) {
    return { allowed: false, status: 401, message: 'Authentication required.' };
  }

  if (!conversation) {
    return { allowed: false, status: 404, message: 'Conversation not found.' };
  }

  // 1. Fetch associated Event to check lifecycle and publication status
  const event = await Event.findById(conversation.eventId);
  if (!event) {
    return { allowed: false, status: 404, message: 'Associated event not found.' };
  }

  // Mandatory Rule: Event must be in approved/published state
  if (event.status !== 'published') {
    return {
      allowed: false,
      status: 403,
      message: 'Chat is only accessible after an event has been approved and published by platform administrators.',
    };
  }

  const userIdStr = user._id.toString();
  const organizerIdStr = conversation.organizerId ? conversation.organizerId.toString() : '';
  const attendeeIdStr = conversation.attendeeId ? conversation.attendeeId.toString() : '';

  // 2. Type: admin_organizer
  if (conversation.type === 'admin_organizer') {
    // Only authorized platform admins or the actual event organizer can access
    if (user.role === 'admin') {
      return { allowed: true, event };
    }

    if (userIdStr === organizerIdStr) {
      return { allowed: true, event };
    }

    return {
      allowed: false,
      status: 403,
      message: 'Forbidden: You do not have permission to access this administrator conversation.',
    };
  }

  // 3. Type: attendee_organizer
  if (conversation.type === 'attendee_organizer') {
    // Admins may view/moderate
    if (user.role === 'admin') {
      return { allowed: true, event };
    }

    // Event organizer check
    if (userIdStr === organizerIdStr) {
      return { allowed: true, event };
    }

    // Attendee check: must be the specific attendee and have a qualifying booking
    if (userIdStr === attendeeIdStr) {
      const isQualified = await hasQualifyingBooking(user._id, conversation.eventId);
      if (!isQualified) {
        return {
          allowed: false,
          status: 403,
          message: 'Forbidden: A valid, confirmed booking is required to communicate with the event organizer.',
        };
      }
      return { allowed: true, event };
    }

    return {
      allowed: false,
      status: 403,
      message: 'Forbidden: You are not an authorized participant in this event conversation.',
    };
  }

  return { allowed: false, status: 403, message: 'Forbidden: Unsupported conversation type.' };
};

/**
 * Creates or retrieves an existing conversation safely with full server-side validation.
 *
 * @param {Object} params
 * @param {Object} params.user - Authenticated user
 * @param {string|mongoose.Types.ObjectId} params.eventId
 * @param {string} params.type - 'admin_organizer' | 'attendee_organizer'
 * @param {string|mongoose.Types.ObjectId} [params.attendeeId] - Target attendee (if organizer initiating)
 * @returns {Promise<{ conversation: Object }>}
 */
export const findOrCreateConversation = async ({ user, eventId, type, attendeeId }) => {
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    const error = new Error('Invalid event ID format.');
    error.status = 400;
    throw error;
  }

  if (!['admin_organizer', 'attendee_organizer'].includes(type)) {
    const error = new Error("Invalid conversation type. Must be 'admin_organizer' or 'attendee_organizer'.");
    error.status = 400;
    throw error;
  }

  const event = await Event.findById(eventId);
  if (!event) {
    const error = new Error('Event not found.');
    error.status = 404;
    throw error;
  }

  if (event.status !== 'published') {
    const error = new Error('Chat conversations can only be initiated for approved and published events.');
    error.status = 403;
    throw error;
  }

  const organizerId = event.organizerId;
  if (!organizerId) {
    const error = new Error('Event does not have a linked organizer.');
    error.status = 400;
    throw error;
  }

  let finalAttendeeId = null;
  const participants = [organizerId];

  if (type === 'admin_organizer') {
    // Only platform admin or the event's actual organizer can initiate
    const isOwner = user._id.toString() === organizerId.toString();
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      const error = new Error('Forbidden: Only the event organizer or platform administrators can open this conversation.');
      error.status = 403;
      throw error;
    }

    if (isAdmin) {
      participants.push(user._id);
    }

    // Atomic find or create
    let conversation = await Conversation.findOne({
      eventId: event._id,
      type: 'admin_organizer',
    })
      .populate('eventId', 'title date venue city image status format')
      .populate('organizerId', 'name email role avatar')
      .populate('participants', 'name email role avatar');

    if (!conversation) {
      try {
        conversation = await Conversation.create({
          type: 'admin_organizer',
          eventId: event._id,
          organizerId,
          attendeeId: null,
          participants,
        });

        conversation = await Conversation.findById(conversation._id)
          .populate('eventId', 'title date venue city image status format')
          .populate('organizerId', 'name email role avatar')
          .populate('participants', 'name email role avatar');
      } catch (err) {
        // Handle duplicate key race condition
        if (err.code === 11000) {
          conversation = await Conversation.findOne({
            eventId: event._id,
            type: 'admin_organizer',
          })
            .populate('eventId', 'title date venue city image status format')
            .populate('organizerId', 'name email role avatar')
            .populate('participants', 'name email role avatar');
        } else {
          throw err;
        }
      }
    }

    return { conversation };
  }

  // Type: attendee_organizer
  if (type === 'attendee_organizer') {
    const isOwner = user._id.toString() === organizerId.toString();
    const isAdmin = user.role === 'admin';

    if (isOwner || isAdmin) {
      // Organizer or admin initiating: attendeeId must be supplied and valid
      if (!attendeeId || !mongoose.Types.ObjectId.isValid(attendeeId)) {
        const error = new Error('A valid attendee ID is required when an organizer opens an attendee conversation.');
        error.status = 400;
        throw error;
      }
      finalAttendeeId = attendeeId;
    } else {
      // Authenticated attendee initiating for themselves
      finalAttendeeId = user._id;
    }

    // Verify target attendee exists
    const attendeeUser = await User.findById(finalAttendeeId);
    if (!attendeeUser) {
      const error = new Error('Attendee not found.');
      error.status = 404;
      throw error;
    }

    // Verify attendee holds a genuine, qualifying booking for this event
    const isQualified = await hasQualifyingBooking(finalAttendeeId, event._id);
    if (!isQualified) {
      const error = new Error('Forbidden: A confirmed, valid booking is required to communicate with the event organizer.');
      error.status = 403;
      throw error;
    }

    participants.push(finalAttendeeId);

    // Atomic find or create
    let conversation = await Conversation.findOne({
      eventId: event._id,
      attendeeId: finalAttendeeId,
      type: 'attendee_organizer',
    })
      .populate('eventId', 'title date venue city image status format')
      .populate('organizerId', 'name email role avatar')
      .populate('attendeeId', 'name email role avatar')
      .populate('participants', 'name email role avatar');

    if (!conversation) {
      try {
        conversation = await Conversation.create({
          type: 'attendee_organizer',
          eventId: event._id,
          organizerId,
          attendeeId: finalAttendeeId,
          participants,
        });

        conversation = await Conversation.findById(conversation._id)
          .populate('eventId', 'title date venue city image status format')
          .populate('organizerId', 'name email role avatar')
          .populate('attendeeId', 'name email role avatar')
          .populate('participants', 'name email role avatar');
      } catch (err) {
        // Handle duplicate key race condition
        if (err.code === 11000) {
          conversation = await Conversation.findOne({
            eventId: event._id,
            attendeeId: finalAttendeeId,
            type: 'attendee_organizer',
          })
            .populate('eventId', 'title date venue city image status format')
            .populate('organizerId', 'name email role avatar')
            .populate('attendeeId', 'name email role avatar')
            .populate('participants', 'name email role avatar');
        } else {
          throw err;
        }
      }
    }

    return { conversation };
  }

  const error = new Error('Unsupported conversation type.');
  error.status = 400;
  throw error;
};
