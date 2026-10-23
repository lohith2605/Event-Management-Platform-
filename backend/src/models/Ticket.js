import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema(
  {
    ticketCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Ticket must be linked to a booking'],
      index: true,
    },
    bookingReference: {
      type: String,
      required: true,
      trim: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Ticket must be linked to an event'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Ticket must belong to an attendee'],
      index: true,
    },
    attendeeName: {
      type: String,
      required: true,
      trim: true,
    },
    ticketType: {
      type: String,
      default: 'General Admission',
      trim: true,
    },
    seatNumber: {
      type: String,
      default: 'General Admission',
      trim: true,
    },
    qrData: {
      type: String,
      required: [true, 'Ticket must include server-issued secure QR verification payload'],
    },
    status: {
      type: String,
      enum: {
        values: ['valid', 'checked_in', 'cancelled'],
        message: '{VALUE} is not a valid ticket status',
      },
      default: 'valid',
      index: true,
    },
    checkedInAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

TicketSchema.index({ userId: 1, status: 1 });
TicketSchema.index({ eventId: 1, status: 1 });
TicketSchema.index({ bookingId: 1, seatNumber: 1 }, { unique: true });

export default mongoose.model('Ticket', TicketSchema);
