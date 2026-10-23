import mongoose from 'mongoose';

export const ALLOWED_EMOJIS = ['👍', '❤️', '🎉', '😂', '😮', '🙏'];

const ReactionSchema = new mongoose.Schema(
  {
    emoji: {
      type: String,
      required: true,
      enum: ALLOWED_EMOJIS,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    userName: {
      type: String,
      trim: true,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const AttachmentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    publicId: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      trim: true,
      default: '',
    },
    mimeType: {
      type: String,
      trim: true,
      default: '',
    },
    size: {
      type: Number,
      default: 0,
    },
    resourceType: {
      type: String,
      default: 'image',
    },
    width: {
      type: Number,
      default: null,
    },
    height: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

const ReplySnapshotSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderName: {
      type: String,
      trim: true,
      default: '',
    },
    senderRole: {
      type: String,
      enum: ['attendee', 'organizer', 'admin'],
      default: 'attendee',
    },
    text: {
      type: String,
      trim: true,
      default: '',
    },
    hasAttachment: {
      type: Boolean,
      default: false,
    },
    attachmentType: {
      type: String,
      enum: ['image', 'document', null],
      default: null,
    },
    originalName: {
      type: String,
      trim: true,
      default: '',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation reference is required'],
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender reference is required'],
      index: true,
    },
    senderName: {
      type: String,
      required: [true, 'Sender name is required'],
      trim: true,
    },
    senderRole: {
      type: String,
      enum: ['attendee', 'organizer', 'admin'],
      required: [true, 'Sender role is required'],
    },
    replyToMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
      index: true,
    },
    replySnapshot: {
      type: ReplySnapshotSchema,
      default: null,
    },
    isForwarded: {
      type: Boolean,
      default: false,
      index: true,
    },
    forwardedFromMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    forwardedFromSenderName: {
      type: String,
      trim: true,
      default: '',
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    text: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
      validate: {
        validator: function (val) {
          const hasText = typeof val === 'string' && val.trim().length > 0;
          const hasAttachment =
            (Array.isArray(this.attachments) && this.attachments.length > 0) ||
            Boolean(this.attachment && this.attachment.url);
          return hasText || hasAttachment;
        },
        message: 'Message must contain text content or an attachment.',
      },
    },
    attachments: {
      type: [AttachmentSchema],
      default: [],
    },
    attachment: {
      type: AttachmentSchema,
      default: null,
    },
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reactions: {
      type: [ReactionSchema],
      default: [],
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// High performance compound indexes for chronological chat queries, search and read tracking
MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ conversationId: 1, 'readBy.userId': 1 });
MessageSchema.index({ conversationId: 1, isDeleted: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, replyToMessageId: 1 });

export default mongoose.model('Message', MessageSchema);
