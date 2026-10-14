import { useState } from 'react';
import {
  X,
  Calendar,
  MapPin,
  Clock,
  Ticket,
  AlertTriangle,
  Loader2,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { cancelBookingApi } from '../api/attendee';

export default function BookingDetailsModal({ booking, onClose, onBookingUpdated }) {
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState(null);

  if (!booking) return null;

  const event = booking.eventId || {};
  const isCancelled = booking.status === 'cancelled';
  const isConfirmed = booking.status === 'confirmed';

  const handleCancelBooking = async () => {
    setCancelling(true);
    setError(null);
    try {
      const res = await cancelBookingApi(booking._id, cancelReason || 'Cancelled by attendee');
      if (res && res.success) {
        if (onBookingUpdated) {
          onBookingUpdated(res.booking);
        }
        setShowCancelConfirm(false);
      } else {
        setError(res?.message || 'Failed to cancel booking.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while cancelling booking.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-dark-panel)]/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative text-[var(--color-main-text)] max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-[var(--color-primary-bg)]/90 border border-[var(--color-borders)] flex items-center justify-center text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="p-6 border-b border-[var(--color-borders)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg font-serif">Booking Receipt</h3>
            <span className="font-mono text-xs font-bold text-[var(--color-primary-action)]">
              {booking.bookingReference}
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Status Indicators */}
          <div className="flex items-center justify-between p-3.5 bg-[var(--color-secondary-bg)] rounded-xl border border-[var(--color-borders)] text-xs">
            <div>
              <span className="text-[10px] text-[var(--color-secondary-text)] block">Booking Status</span>
              <span
                className={`font-bold uppercase tracking-wider text-[11px] ${
                  isCancelled
                    ? 'text-red-500'
                    : isConfirmed
                    ? 'text-emerald-500'
                    : 'text-amber-500'
                }`}
              >
                ● {booking.status}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--color-secondary-text)] block">Payment</span>
              <span className="font-bold uppercase tracking-wider text-[11px] text-[var(--color-main-text)]">
                {booking.paymentStatus === 'free' ? 'Free Pass' : booking.paymentStatus}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--color-secondary-text)] block">Booked On</span>
              <span className="font-medium text-[var(--color-main-text)]">
                {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>

          {/* Event Snapshot */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary-text)]">
              Event Details
            </span>
            <div className="p-3.5 rounded-xl border border-[var(--color-borders)] bg-[var(--color-card-bg)] space-y-2">
              <h4 className="font-bold text-sm text-[var(--color-main-text)]">{event.title}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[var(--color-secondary-text)]">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[var(--color-primary-action)]" />
                  <span>{event.date} • {event.time}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[var(--color-golden-accent)]" />
                  <span className="truncate">{event.venue}, {event.city}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Itemized Billing Breakdown */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary-text)]">
              Order Breakdown
            </span>
            <div className="p-3.5 rounded-xl border border-[var(--color-borders)] bg-[var(--color-secondary-bg)] space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-main-text)]">
                  {booking.ticketType} (Qty: {booking.quantity})
                </span>
                <span className="font-semibold text-[var(--color-main-text)]">
                  {booking.unitPrice > 0 ? `₹${booking.unitPrice} each` : 'Free'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[var(--color-borders)] font-bold">
                <span>Total Amount</span>
                <span className="text-sm text-[var(--color-primary-action)]">
                  {booking.totalAmount > 0 ? `₹${booking.totalAmount}` : '₹0 (Free)'}
                </span>
              </div>
            </div>
          </div>

          {/* Attendee Details */}
          <div className="p-3 bg-[var(--color-secondary-bg)]/60 rounded-xl space-y-1 text-xs">
            <span className="text-[10px] uppercase font-bold text-[var(--color-secondary-text)]">
              Registered Attendee
            </span>
            <p className="font-semibold text-[var(--color-main-text)]">{booking.attendeeName}</p>
            <p className="text-[var(--color-secondary-text)]">{booking.attendeeEmail}</p>
          </div>

          {/* Cancellation Info or Action */}
          {isCancelled ? (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 space-y-1">
              <span className="font-bold block">This booking was cancelled</span>
              <p>
                Reason: {booking.cancellationReason || 'Cancelled by attendee'}{' '}
                {booking.cancelledAt && `on ${new Date(booking.cancelledAt).toLocaleDateString()}`}
              </p>
            </div>
          ) : isConfirmed ? (
            <div>
              {showCancelConfirm ? (
                <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 space-y-3 animate-fade-in text-xs">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Confirm Booking Cancellation</span>
                  </div>
                  <p className="text-[var(--color-secondary-text)]">
                    Are you sure you want to cancel this booking? Your issued admission passes will be deactivated and spots will be released back to the event.
                  </p>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Optional cancellation reason..."
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-card-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden"
                  />
                  {error && <p className="text-red-500 font-medium">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCancelBooking}
                      disabled={cancelling}
                      className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {cancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Yes, Cancel Booking</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(false)}
                      className="py-2 px-3 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-[var(--color-main-text)] font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Keep Booking
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full py-2.5 px-3 rounded-xl border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel This Booking
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
