import { useState } from 'react';
import {
  X,
  Ticket,
  User,
  Calendar,
  MapPin,
  IndianRupee,
  AlertTriangle,
  Undo2,
  CheckCircle,
  XCircle,
  CreditCard,
  Clock,
} from 'lucide-react';

export default function AdminBookingDetailModal({
  booking,
  tickets = [],
  isOpen,
  onClose,
  onCancelRefund,
  isProcessing = false,
}) {
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');

  if (!isOpen || !booking) return null;

  const handleRefundSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setValidationError('Please provide a reason for cancelling this booking and processing a refund.');
      return;
    }
    setValidationError('');
    onCancelRefund(booking._id, reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[85vh] flex flex-col text-[var(--color-main-text)]">
        {/* Header */}
        <div className="p-6 border-b border-[var(--color-borders)] flex items-center justify-between shrink-0 bg-[var(--color-secondary-bg)]/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)] border border-[var(--color-primary-action)]/25 flex items-center justify-center">
              <Ticket className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-base sm:text-lg">
                  {booking.bookingReference}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                    booking.status === 'confirmed'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : booking.status === 'cancelled'
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {booking.status}
                </span>
              </div>
              <p className="text-xs text-[var(--color-secondary-text)]">
                Booked on {new Date(booking.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Cancellation & Refund notice */}
          {booking.status === 'cancelled' && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 space-y-2">
              <span className="font-bold flex items-center gap-1.5 text-xs">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>Order Cancelled & Passes Deactivated</span>
              </span>
              <p className="text-[11px] leading-relaxed">
                Cancelled on: {booking.cancelledAt ? new Date(booking.cancelledAt).toLocaleString() : 'N/A'}<br />
                Reason: {booking.cancellationReason || 'Administrative cancellation'}
              </p>
              <div className="pt-2 border-t border-red-500/20 flex flex-wrap gap-2 text-[10px]">
                <span className="px-2 py-0.5 rounded-full font-bold bg-white/70 dark:bg-black/30 border border-red-300 dark:border-red-900">
                  Refund: {booking.refundStatus ? booking.refundStatus.toUpperCase() : (booking.totalAmount === 0 ? 'FREE PASS' : 'NONE')}
                  {booking.refundAmount ? ` (₹${booking.refundAmount})` : ''}
                </span>
                {booking.razorpayRefundId && (
                  <span className="px-2 py-0.5 rounded-full font-mono bg-white/70 dark:bg-black/30 border border-red-300 dark:border-red-900">
                    ID: {booking.razorpayRefundId}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full font-bold bg-white/70 dark:bg-black/30 border border-red-300 dark:border-red-900">
                  Email: {booking.cancellationEmailSent ? '✓ Sent to Attendee' : (booking.cancellationEmailStatus || 'Pending')}
                </span>
              </div>
            </div>
          )}

          {/* Attendee & Event Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)] rounded-2xl space-y-2">
              <span className="text-[10px] uppercase font-bold text-[var(--color-secondary-text)] block">
                Attendee Details
              </span>
              <p className="font-bold text-sm text-[var(--color-main-text)]">{booking.attendeeName}</p>
              <div className="text-[11px] text-[var(--color-secondary-text)] space-y-0.5">
                <p>Email: {booking.attendeeEmail}</p>
                <p>Phone: {booking.attendeePhone || 'Not provided'}</p>
              </div>
            </div>

            <div className="p-4 bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)] rounded-2xl space-y-2">
              <span className="text-[10px] uppercase font-bold text-[var(--color-secondary-text)] block">
                Event Information
              </span>
              <p className="font-bold text-sm text-[var(--color-main-text)]">{booking.eventId?.title || 'Event'}</p>
              <div className="text-[11px] text-[var(--color-secondary-text)] space-y-0.5">
                <p>{booking.eventId?.date} &bull; {booking.eventId?.venue}</p>
                <p>{booking.eventId?.city} ({booking.eventId?.format || 'In-Person'})</p>
              </div>
            </div>
          </div>

          {/* Pricing & Payment Summary */}
          <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl space-y-2">
            <span className="text-[10px] uppercase font-bold text-[var(--color-secondary-text)] block">
              Payment & Order Breakdown
            </span>
            <div className="divide-y divide-[var(--color-borders)]/50 text-[11px]">
              <div className="py-1.5 flex justify-between">
                <span>Ticket Tier:</span>
                <strong className="text-[var(--color-main-text)]">{booking.ticketType}</strong>
              </div>
              <div className="py-1.5 flex justify-between">
                <span>Quantity:</span>
                <strong className="text-[var(--color-main-text)]">{booking.quantity} passes</strong>
              </div>
              <div className="py-1.5 flex justify-between">
                <span>Unit Price:</span>
                <span>{booking.unitPrice === 0 ? 'Free' : `₹${booking.unitPrice}`}</span>
              </div>
              <div className="py-1.5 flex justify-between">
                <span>Payment Method:</span>
                <span className="capitalize">{booking.paymentMethod?.replace(/_/g, ' ') || 'Free Pass'}</span>
              </div>
              <div className="py-1.5 flex justify-between">
                <span>Payment Status:</span>
                <span className="font-bold uppercase text-[var(--color-primary-action)]">{booking.paymentStatus}</span>
              </div>
              <div className="py-2 flex justify-between font-black text-sm">
                <span>Total Amount:</span>
                <span className="text-[var(--color-primary-action)]">
                  {booking.totalAmount === 0 ? 'Free Pass' : `₹${booking.totalAmount} ${booking.currency}`}
                </span>
              </div>
            </div>
          </div>

          {/* Issued Tickets List */}
          {Array.isArray(tickets) && tickets.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--color-secondary-text)]">
                Issued Passes ({tickets.length})
              </h4>
              <div className="divide-y divide-[var(--color-borders)] border border-[var(--color-borders)] rounded-2xl overflow-hidden bg-[var(--color-secondary-bg)]/20">
                {tickets.map((tkt) => (
                  <div key={tkt._id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold block">{tkt.ticketCode}</span>
                      <span className="text-[10px] text-[var(--color-secondary-text)]">
                        Seat: {tkt.seatNumber} &bull; Tier: {tkt.ticketType}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tkt.status === 'valid'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : 'bg-red-500/15 text-red-600 dark:text-red-400'
                      }`}
                    >
                      {tkt.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Refund action form */}
          {showRefundForm && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-3">
              <span className="font-bold text-xs text-red-700 dark:text-red-400 flex items-center gap-1.5">
                <Undo2 className="w-4 h-4" />
                <span>Confirm Cancellation & Process Refund</span>
              </span>
              <p className="text-[11px] text-[var(--color-secondary-text)]">
                This action will restore <strong>{booking.quantity}</strong> ticket spots back into the event inventory, deactivate issued passes, and notify the attendee.
              </p>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setValidationError('');
                }}
                rows={3}
                placeholder="State the cancellation and refund reason..."
                className="w-full p-2.5 rounded-xl text-xs bg-[var(--color-input-bg)] border border-red-300 dark:border-red-900 text-[var(--color-main-text)] focus:outline-hidden"
              />
              {validationError && (
                <p className="text-[11px] text-red-600 font-semibold">{validationError}</p>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRefundForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--color-secondary-text)] hover:underline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRefundSubmit}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
                >
                  {isProcessing ? 'Processing Refund...' : 'Confirm Cancellation & Refund'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[var(--color-secondary-bg)]/50 border-t border-[var(--color-borders)] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
          >
            Close
          </button>

          {booking.status === 'confirmed' && !showRefundForm && (
            <button
              type="button"
              onClick={() => {
                setReason('');
                setValidationError('');
                setShowRefundForm(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
            >
              Cancel & Process Refund
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
