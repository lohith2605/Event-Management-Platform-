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
  Tag,
  Check,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  createBookingApi,
  verifyPaymentApi,
  recordPaymentFailureApi,
} from '../api/attendee';
import { validateCouponApi } from '../api/coupons';
import { loadRazorpayScript } from '../utils/razorpay';

export default function BookingModal({ event, onClose, onBookingSuccess }) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState(null);
  const [couponSuccess, setCouponSuccess] = useState(null);

  if (!event) return null;

  const isFreeEvent = (event.priceNumber || 0) === 0;
  const unitPrice = event.priceNumber || 0;
  const rawSubtotal = unitPrice * quantity;
  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const finalPayable = appliedCoupon ? appliedCoupon.finalAmount : rawSubtotal;
  const isZeroPayable = finalPayable === 0;
  const effectiveIsFree = isFreeEvent || isZeroPayable;

  const spotsAvailable = event.spotsLeft !== undefined ? event.spotsLeft : 100;
  const isSoldOut = spotsAvailable <= 0;
  const maxAllowed = Math.min(5, Math.max(1, spotsAvailable));

  // Helper to revalidate an already applied coupon if quantity changes
  const revalidateWithNewQty = async (newQty) => {
    if (!appliedCoupon) return;
    try {
      const res = await validateCouponApi({
        eventId: event._id || event.id,
        quantity: newQty,
        code: appliedCoupon.coupon.code,
      });

      if (res && res.valid) {
        setAppliedCoupon(res);
        setCouponSuccess(`Coupon ${res.coupon.code} applied! Saved ₹${res.discountAmount}`);
        setCouponError(null);
      } else {
        setAppliedCoupon(null);
        setCouponSuccess(null);
        setCouponError(res?.message || 'Coupon requirement no longer met for this quantity.');
      }
    } catch (err) {
      setAppliedCoupon(null);
      setCouponSuccess(null);
      setCouponError(err.message || 'Coupon could not be applied for this quantity.');
    }
  };

  const handleIncrement = () => {
    if (quantity < maxAllowed) {
      const nextQty = quantity + 1;
      setQuantity(nextQty);
      if (appliedCoupon) {
        revalidateWithNewQty(nextQty);
      }
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      const nextQty = quantity - 1;
      setQuantity(nextQty);
      if (appliedCoupon) {
        revalidateWithNewQty(nextQty);
      }
    }
  };

  const handleApplyCoupon = async (e) => {
    if (e) e.preventDefault();
    const trimmed = couponInput.trim().toUpperCase();
    if (!trimmed) {
      setCouponError('Please enter a coupon code.');
      return;
    }

    setValidatingCoupon(true);
    setCouponError(null);
    setCouponSuccess(null);

    try {
      const res = await validateCouponApi({
        eventId: event._id || event.id,
        quantity,
        code: trimmed,
      });

      if (res && res.valid) {
        setAppliedCoupon(res);
        setCouponSuccess(
          `Coupon "${res.coupon.code}" applied! You saved ₹${res.discountAmount}.`
        );
        setCouponInput('');
      } else {
        setAppliedCoupon(null);
        setCouponError(res?.message || 'Invalid coupon code.');
      }
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.message || 'Failed to validate coupon code.');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponSuccess(null);
    setCouponInput('');
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
        ticketType: effectiveIsFree
          ? 'General Admission (Free Pass)'
          : 'Standard Admission',
        couponCode: appliedCoupon ? appliedCoupon.coupon.code : '',
      });

      if (!res || !res.success) {
        setError(res?.message || 'Failed to complete booking. Please try again.');
        setSubmitting(false);
        return;
      }

      // Free events or 100% coupon discount confirm immediately
      if (res.isFree || res.booking?.paymentStatus === 'free') {
        setSuccessData(res);
        if (onBookingSuccess) {
          onBookingSuccess(res);
        }
        setSubmitting(false);
        return;
      }

      // Paid event: Launch Razorpay Checkout with server-created order
      if (res.order) {
        const isScriptLoaded = await loadRazorpayScript();
        if (!isScriptLoaded || !window.Razorpay) {
          setError(
            'Payment checkout failed to initialize. Please check your internet connection or disable adblockers.'
          );
          setSubmitting(false);
          return;
        }

        const razorpayKey =
          res.order.keyId || res.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID;

        const options = {
          key: razorpayKey,
          amount: res.order.amount,
          currency: res.order.currency || 'INR',
          name: 'UTSAV',
          description: `${quantity}x ${event.title}`,
          order_id: res.order.id,
          prefill: {
            name: user?.name || '',
            email: user?.email || '',
            contact: user?.phone || '',
          },
          theme: {
            color: '#6366f1',
          },
          handler: async (paymentResponse) => {
            // Server-side verification of cryptographic payment signature
            setSubmitting(true);
            try {
              const verifyRes = await verifyPaymentApi({
                bookingId: res.booking._id,
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature,
              });

              if (verifyRes && verifyRes.success) {
                setSuccessData(verifyRes);
                if (onBookingSuccess) {
                  onBookingSuccess(verifyRes);
                }
              } else {
                setError(verifyRes?.message || 'Payment verification failed on server.');
              }
            } catch (vErr) {
              setError(vErr.message || 'Payment verification failed. Please contact support.');
            } finally {
              setSubmitting(false);
            }
          },
          modal: {
            ondismiss: async () => {
              setSubmitting(false);
              try {
                await recordPaymentFailureApi({
                  bookingId: res.booking._id,
                  razorpay_order_id: res.order.id,
                  error: { description: 'Checkout window dismissed by attendee' },
                });
              } catch (e) {
                // Non-blocking
              }
              setError(
                'Payment window closed. Your reservation is held for 10 minutes. You can complete payment from My Bookings.'
              );
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', async (failedData) => {
          setSubmitting(false);
          try {
            await recordPaymentFailureApi({
              bookingId: res.booking._id,
              razorpay_order_id: res.order.id,
              error: failedData.error,
            });
          } catch (e) {
            // Non-blocking
          }
          setError(
            `Payment failed: ${failedData.error?.description || 'Transaction was declined.'}`
          );
        });

        rzp.open();
      } else {
        // Fallback if gateway is in maintenance or pending
        setSuccessData(res);
        if (onBookingSuccess) {
          onBookingSuccess(res);
        }
        setSubmitting(false);
      }
    } catch (err) {
      setError(err.message || 'An error occurred during booking. Please try again.');
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
                  {effectiveIsFree ? 'Booking Confirmed!' : 'Payment Verified & Confirmed!'}
                </h3>
                <p className="text-xs text-[var(--color-secondary-text)] mt-1">
                  {effectiveIsFree
                    ? `Your ${quantity} digital pass${quantity > 1 ? 'es are' : ' is'} issued and ready for admission.`
                    : `Payment verified successfully. Your ${quantity} digital pass${quantity > 1 ? 'es are' : ' is'} ready in My Tickets.`}
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

                {/* Show coupon details if applied */}
                {successData.booking?.couponCode && (
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                    <span className="flex items-center gap-1 font-medium">
                      <Tag className="w-3.5 h-3.5" />
                      Coupon ({successData.booking.couponCode})
                    </span>
                    <span className="font-bold">
                      -₹{successData.booking.discountAmount || discountAmount}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-[var(--color-borders)]">
                  <span className="text-[var(--color-secondary-text)]">Total Paid</span>
                  <span className="font-bold text-[var(--color-main-text)] text-sm">
                    {successData.booking?.totalAmount === 0 || effectiveIsFree
                      ? '₹0 (Free Pass)'
                      : `₹${successData.booking?.totalAmount || finalPayable}`}
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
                  <span className="truncate">
                    {event.venue}, {event.city}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-borders)]/80">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-[var(--color-primary-action)]" />
                    <span className="font-bold text-[var(--color-main-text)]">
                      {isFreeEvent ? 'Free Admission' : `Price: ${event.price}`}
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

                  {/* Coupon & Discount Management (Feature 13) */}
                  {!isFreeEvent && (
                    <div className="p-3.5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="checkout-coupon-code"
                          className="text-xs font-bold text-[var(--color-main-text)] flex items-center gap-1.5"
                        >
                          <Tag className="w-3.5 h-3.5 text-[var(--color-primary-action)]" />
                          <span>Promo Code or Coupon</span>
                        </label>
                        {appliedCoupon && (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            Coupon Applied
                          </span>
                        )}
                      </div>

                      {appliedCoupon ? (
                        /* Applied Coupon Badge with Remove button */
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs animate-fade-in">
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                                  {appliedCoupon.coupon.code}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-600 text-white rounded">
                                  -₹{appliedCoupon.discountAmount}
                                </span>
                              </div>
                              {appliedCoupon.coupon.description && (
                                <p className="text-[11px] text-[var(--color-secondary-text)] mt-0.5">
                                  {appliedCoupon.coupon.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveCoupon}
                            className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded hover:bg-red-500/10 transition-colors cursor-pointer flex items-center gap-1"
                            title="Remove coupon"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      ) : (
                        /* Coupon Input Field */
                        <form
                          onSubmit={handleApplyCoupon}
                          className="flex items-center gap-2"
                        >
                          <div className="relative flex-1">
                            <input
                              id="checkout-coupon-code"
                              type="text"
                              placeholder="Enter coupon code (e.g. UTSAV20)"
                              value={couponInput}
                              onChange={(e) => {
                                setCouponInput(e.target.value.toUpperCase());
                                setCouponError(null);
                              }}
                              className="w-full text-xs font-mono uppercase px-3 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg text-[var(--color-main-text)] placeholder:text-[var(--color-secondary-text)] focus:outline-none focus:border-[var(--color-primary-action)]"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={validatingCoupon || !couponInput.trim()}
                            className="px-3.5 py-2 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-[var(--color-main-text)] hover:text-[var(--color-primary-action)] font-bold text-xs rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            {validatingCoupon ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <span>Apply</span>
                            )}
                          </button>
                        </form>
                      )}

                      {/* Coupon Feedback Messages */}
                      {couponSuccess && !appliedCoupon && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>{couponSuccess}</span>
                        </p>
                      )}
                      {couponError && (
                        <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1 animate-fade-in">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{couponError}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Summary & Price Breakdown */}
                  <div className="p-3 bg-[var(--color-secondary-bg)]/60 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-secondary-text)]">Attendee</span>
                      <span className="font-semibold text-[var(--color-main-text)]">
                        {user?.name} ({user?.email})
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[var(--color-secondary-text)]">Order Subtotal</span>
                      <span className="font-semibold text-[var(--color-main-text)]">
                        {isFreeEvent
                          ? 'Free (₹0)'
                          : `₹${unitPrice} × ${quantity} = ₹${rawSubtotal}`}
                      </span>
                    </div>

                    {appliedCoupon && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          Coupon Discount ({appliedCoupon.coupon.code})
                        </span>
                        <span className="font-bold">-₹{discountAmount}</span>
                      </div>
                    )}

                    <div className="flex justify-between pt-1 border-t border-[var(--color-borders)]">
                      <span className="font-bold text-[var(--color-main-text)]">Final Payable</span>
                      <span className="font-extrabold text-[var(--color-main-text)] text-sm">
                        {effectiveIsFree ? '₹0 (Free Pass)' : `₹${finalPayable}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-secondary-text)] pt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Official digital passes with instant QR check-in.</span>
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
                    ) : effectiveIsFree ? (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>
                          Confirm Free Booking ({quantity} pass{quantity > 1 ? 'es' : ''})
                          {appliedCoupon ? ' • Coupon Applied' : ''}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>Pay & Confirm • ₹{finalPayable}</span>
                        {appliedCoupon && (
                          <span className="text-[10px] opacity-90 line-through">
                            ₹{rawSubtotal}
                          </span>
                        )}
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
                      To reserve your ticket, apply discount coupons, receive your dynamic QR admission pass, and access event updates, sign in to your UTSAV account or register in seconds.
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
