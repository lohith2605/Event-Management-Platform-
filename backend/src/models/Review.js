import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Review must be for a valid event'],
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Please provide a star rating between 1 and 5'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars'],
    },
    comment: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Review cannot exceed 1000 characters'],
    },
    attendeeName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['published', 'flagged', 'hidden'],
      default: 'published',
      index: true,
    },
    moderationReason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce single review per attendee per event
ReviewSchema.index({ userId: 1, eventId: 1 }, { unique: true });
ReviewSchema.index({ eventId: 1, createdAt: -1 });

export default mongoose.model('Review', ReviewSchema);
