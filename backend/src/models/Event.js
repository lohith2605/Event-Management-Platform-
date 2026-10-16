import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide an event title'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: [300, 'Tagline cannot exceed 300 characters'],
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Please select an event category'],
      index: true,
    },
    date: {
      type: String,
      required: [true, 'Please provide an event display date'],
    },
    isoDate: {
      type: Date,
      required: [true, 'Please provide a valid ISO start date for sorting'],
      index: true,
    },
    time: {
      type: String,
      default: '10:00 AM IST',
    },
    city: {
      type: String,
      required: [true, 'Please specify the host city'],
      index: true,
    },
    venue: {
      type: String,
      required: [true, 'Please specify the event venue or virtual link'],
    },
    price: {
      type: String,
      default: 'Free',
    },
    priceNumber: {
      type: Number,
      default: 0,
      index: true,
    },
    image: {
      type: String,
      default: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    },
    organizer: {
      type: String,
      required: [true, 'Organizer name is required'],
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    spotsLeft: {
      type: Number,
      default: 100,
    },
    totalCapacity: {
      type: Number,
      default: 500,
    },
    format: {
      type: String,
      enum: ['In-Person', 'Online', 'Hybrid'],
      default: 'In-Person',
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'published', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    cancellationReason: {
      type: String,
      default: '',
      trim: true,
    },
    registrationDeadline: {
      type: Date,
    },
    ticketTiers: [
      {
        name: { type: String, default: 'General Admission', trim: true },
        price: { type: Number, default: 0, min: 0 },
        capacity: { type: Number, default: 100, min: 1 },
        spotsLeft: { type: Number, default: 100, min: 0 },
        description: { type: String, default: '', trim: true },
      },
    ],
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      index: true,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for search and filtering performance
EventSchema.index({ status: 1, isoDate: 1 });
EventSchema.index({ title: 'text', tagline: 'text', venue: 'text' });

export default mongoose.model('Event', EventSchema);
