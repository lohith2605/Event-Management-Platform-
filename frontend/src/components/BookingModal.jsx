import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Calendar,
  MapPin,
  QrCode,
  Ticket,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Minus,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { createBookingApi } from '../api/attendee';

export default function BookingModal({ event, onClose, onBookingSuccess }) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);

  if (!event) return null;

  const isFree = (event.priceNumber || 0) === 0;
  const unitPrice = event.priceNumber || 0;
  const totalPrice = unitPrice * quantity;
  const spotsAvailable = event.spotsLeft !== undefined ? event.spotsLeft : 100;
  const isSoldOut = spotsAvailable <= 0;
  const maxAllowed = Math.min(5, Math.max(1, spotsAvailable));

  const handleIncrement = () => {
    if (quantity < maxAllowed) {
      setQuantity((prev) => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  const handleBookTickets = async () => {
    if (!isAuthenticated) {
      onClose();
      navigate('/login');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await createBookingApi({
        eventId: event._id || event.id,
        quantity,
        ticketType: isFree ? 'General Admission (Free Pass)' : 'Standard Admission',
      });

      if (res && res.success) {
        setSuccessData(res);
        if (onBookingSuccess) {
          onBookingSuccess(res);
        }
      } else {
        setError(res?.message || 'Failed to complete booking. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-dark-panel)]/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative text-[var(--color-main-text)] max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-[var(--color-primary-bg)]/90 border border-[var(--color-borders)] flex items-center justify-center text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Banner */}
        <div className="relative aspect-[21/8] bg-[var(--color-secondary-bg)] overflow-hidden shrink-0">
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-dark-panel)]/90 via-[var(--color-dark-panel)]/30 to-transparent flex items-end p-4">
            <span className="bg-[var(--color-primary-action)] text-[var(--color-primary-text)] text-xs font-bold px-3 py-1 rounded-lg shadow-xs">
              {event.category}
            </span>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {successData ? (
            /* Booking Confirmed State */
            <div className="space-y-5 text-center py-2 animate-fade-in">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="font-extrabold text-xl text-[var(--color-main-text)] font-serif">
                  {isFree ? 'Booking Confirmed!' : 'Booking Reserved'}
                </h3>
                <p className="text-xs text-[var(--color-secondary-text)] mt-1">
                  {isFree
                    ? `Your ${quantity} digital pass${quantity > 1 ? 'es are' : ' is'} issued and ready for admission.`
                    : 'Your reservation is recorded. Payment gateway is pending configuration.'}
                </p>
              </div>

              <div className="bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-xl p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-[var(--color-borders)]">
                  <span className="text-[var(--color-secondary-text)]">Booking Reference</span>
                  <span className="font-mono font-bold text-[var(--color-primary-action)]">
                    {successData.booking?.bookingReference}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-secondary-text)]">Event</span>
                  <span className="font-semibold text-[var(--color-main-text)] truncate max-w-[200px]">
                    {event.title}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-secondary-text)]">Passes Issued</span>
                  <span className="font-semibold text-[var(--color-main-text)]">{quantity}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[var(--color-borders)]">
                  <span className="text-[var(--color-secondary-text)]">Total Paid</span>
                  <span className="font-bold text-[var(--color-main-text)]">
                    {isFree ? '₹0 (Free Pass)' : `₹${totalPrice}`}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/attendee/tickets');
                  }}
                  className="flex-1 py-2.5 px-4 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-xs sm:text-sm rounded-xl transition-all text-center shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <Ticket className="w-4 h-4" />
                  <span>View in My Tickets</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-[var(--color-main-text)] font-semibold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Booking Selection / Confirmation Flow */
            <>
              <div>
                <h3 className="font-extrabold text-xl text-[var(--color-main-text)] leading-snug font-serif">
                  {event.title}
                </h3>
                <p className="text-xs text-[var(--color-secondary-text)] mt-1 leading-relaxed">
                  {event.tagline || event.description}
                </p>
              </div>

              {/* Event Metadata */}
              <div className="bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-xl p-3.5 space-y-2 text-xs text-[var(--color-secondary-text)]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--color-primary-action)] shrink-0" />
                  <span className="font-semibold text-[var(--color-main-text)]">
                    {event.date} • {event.time}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[var(--color-golden-accent)] shrink-0" />
                  <span className="truncate">{event.venue}, {event.city}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-borders)]/80">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-[var(--color-primary-action)]" />
                    <span className="font-bold text-[var(--color-main-text)]">
                      {isFree ? 'Free Admission' : `Price: ${event.price}`}
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isSoldOut
                        ? 'bg-red-500/15 text-red-600 border border-red-500/20'
                        : spotsAvailable < 20
                        ? 'bg-amber-500/15 text-amber-600 border border-amber-500/20'
                        : 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20'
                    }`}
                  >
                    {isSoldOut ? 'Sold Out' : `${spotsAvailable} spots left`}
                  </span>
                </div>
              </div>

              {isAuthenticated ? (
                /* Authenticated Booking Form */
                <div className="space-y-4">
                  {/* Quantity selector */}
                  <div className="flex items-center justify-between p-3.5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-xl">
                    <div>
                      <span className="text-xs font-bold text-[var(--color-main-text)] block">
                        Select Ticket Quantity
                      </span>
                      <span className="text-[11px] text-[var(--color-secondary-text)]">
                        Max {maxAllowed} per order
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleDecrement}
                        disabled={quantity <= 1 || isSoldOut}
                        className="w-8 h-8 rounded-lg border border-[var(--color-borders)] bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] flex items-center justify-center disabled:opacity-40 transition-colors cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold text-sm min-w-5 text-center">{quantity}</span>
                      <button
                        type="button"
                        onClick={handleIncrement}
                        disabled={quantity >= maxAllowed || isSoldOut}
                        className="w-8 h-8 rounded-lg border border-[var(--color-borders)] bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] flex items-center justify-center disabled:opacity-40 transition-colors cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Summary & Price Breakdown */}
                  <div className="p-3 bg-[var(--color-secondary-bg)]/60 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-secondary-text)]">Attendee</span>
                      <span className="font-semibold text-[var(--color-main-text)]">{user?.name} ({user?.email})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-secondary-text)]">Order Subtotal</span>
                      <span className="font-bold text-[var(--color-main-text)]">
                        {isFree ? 'Free (₹0)' : `₹${unitPrice} × ${quantity} = ₹${totalPrice}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-secondary-text)] pt-1 border-t border-[var(--color-borders)]">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Authentic server-issued digital passes with instant QR verification.</span>
                    </div>
                  </div>

                  {/* Error Notification */}
                  {error && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={handleBookTickets}
                    disabled={submitting || isSoldOut}
                    className="w-full py-3 px-4 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-xs sm:text-sm rounded-xl transition-all text-center shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Reserving Tickets...</span>
                      </>
                    ) : isSoldOut ? (
                      <span>Sold Out</span>
                    ) : isFree ? (
                      <>
                        <span>Confirm Free Booking ({quantity} pass{quantity > 1 ? 'es' : ''})</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>Reserve Booking • ₹{totalPrice}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Unauthenticated Sign-in Notice */
                <div className="space-y-4">
                  <div className="bg-[var(--color-accent-soft)] border border-[var(--color-primary-action)]/30 rounded-xl p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-[var(--color-primary-action)] font-bold text-xs uppercase tracking-wider">
                      <QrCode className="w-4 h-4" />
                      <span>Sign In Required for Digital Pass</span>
                    </div>
                    <p className="text-xs text-[var(--color-main-text)] leading-relaxed">
                      To reserve your verified seat, receive your server-issued dynamic QR admission pass, and access attendee updates, sign in to your UTSAV account or register in seconds.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate('/login');
                      }}
                      className="flex-1 py-3 px-4 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-xs sm:text-sm rounded-xl transition-all text-center shadow-xs cursor-pointer"
                    >
                      Sign In to Book
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate('/signup');
                      }}
                      className="flex-1 py-3 px-4 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-[var(--color-main-text)] font-semibold text-xs sm:text-sm rounded-xl transition-colors text-center cursor-pointer"
                    >
                      Create Free Account
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
