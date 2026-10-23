import mongoose from 'mongoose';

const ConversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: {
        values: ['admin_organizer', 'attendee_organizer'],
        message: '{VALUE} is not a valid conversation type',
      },
      required: [true, 'Conversation type is required'],
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Associated event is required'],
      index: true,
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Event organizer is required'],
      index: true,
    },
    // Present only for attendee_organizer conversations
    attendeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    // Array of participant user IDs for unified indexing and queries
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],
    lastMessage: {
      text: {
        type: String,
        default: '',
        trim: true,
      },
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      senderName: {
        type: String,
        default: '',
      },
      senderRole: {
        type: String,
        default: '',
      },
      createdAt: {
        type: Date,
        default: null,
      },
    },
    // Map of user ID strings to number of unread messages
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    // Pinned message metadata for this conversation (one pinned message at a time)
    pinnedMessage: {
      type: new mongoose.Schema(
        {
          messageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            required: true,
          },
          text: {
            type: String,
            default: '',
            trim: true,
          },
          senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
          },
          senderName: {
            type: String,
            default: '',
            trim: true,
          },
          senderRole: {
            type: String,
            default: '',
            trim: true,
          },
          hasAttachment: {
            type: Boolean,
            default: false,
          },
          attachmentType: {
            type: String,
            default: null,
          },
          originalName: {
            type: String,
            default: '',
            trim: true,
          },
          pinnedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
          },
          pinnedByName: {
            type: String,
            default: '',
            trim: true,
          },
          pinnedAt: {
            type: Date,
            default: Date.now,
          },
        },
        { _id: false }
      ),
      default: null,
    },
    // Tracks per-user soft-deletion / inbox hiding with deletion timestamp
    deletedFor: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        deletedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Database-enforced uniqueness:
// 1. One admin_organizer conversation per event
ConversationSchema.index(
  { eventId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'admin_organizer' },
  }
);

// 2. One attendee_organizer conversation per event and attendee
ConversationSchema.index(
  { eventId: 1, attendeeId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'attendee_organizer' },
  }
);

// Unified lookup indexes
ConversationSchema.index({ participants: 1, updatedAt: -1 });
ConversationSchema.index({ eventId: 1, updatedAt: -1 });
ConversationSchema.index({ 'deletedFor.userId': 1 });

export default mongoose.model('Conversation', ConversationSchema);
