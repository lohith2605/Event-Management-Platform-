import { useState } from 'react';
import { X, Star, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { submitReviewApi } from '../api/attendee';

export default function ReviewModal({ event, existingReview, onClose, onReviewSubmitted }) {
  const [rating, setRating] = useState(existingReview?.rating || 5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!event) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await submitReviewApi({
        eventId: event._id || event.id,
        rating,
        comment: comment.trim(),
      });

      if (res && res.success) {
        setSuccess(true);
        if (onReviewSubmitted) {
          onReviewSubmitted(res.review);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(res?.message || 'Failed to submit review.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while submitting your review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-dark-panel)]/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative text-[var(--color-main-text)]">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-[var(--color-primary-bg)]/90 border border-[var(--color-borders)] flex items-center justify-center text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 space-y-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-golden-accent)]">
              Attendee Review
            </span>
            <h3 className="font-extrabold text-lg font-serif mt-0.5">
              Review: {event.title}
            </h3>
            <p className="text-xs text-[var(--color-secondary-text)] mt-1">
              Share your genuine experience with fellow campus attendees.
            </p>
          </div>

          {success ? (
            <div className="text-center py-6 space-y-2 animate-fade-in">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-base">Review Saved!</h4>
              <p className="text-xs text-[var(--color-secondary-text)]">
                Thank you for contributing to the UTSAV attendee community.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Star Rating Selector */}
              <div>
                <label className="text-xs font-bold block mb-1.5">Your Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoverRating || rating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 transition-transform hover:scale-110 cursor-pointer focus:outline-hidden"
                      >
                        <Star
                          className={`w-7 h-7 ${
                            active
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-[var(--color-borders)]'
                          } transition-colors`}
                        />
                      </button>
                    );
                  })}
                  <span className="text-xs font-bold text-[var(--color-secondary-text)] ml-2">
                    {rating} of 5 Stars
                  </span>
                </div>
              </div>

              {/* Review Comment Textarea */}
              <div>
                <label className="text-xs font-bold block mb-1.5">
                  Written Feedback <span className="font-normal text-[var(--color-secondary-text)]">(Optional)</span>
                </label>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What did you like about the venue, stage organization, hackathon mentorship, or schedule?..."
                  maxLength={1000}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] placeholder-[var(--color-secondary-text)]/60 focus:outline-hidden focus:border-[var(--color-primary-action)] resize-none"
                />
                <span className="text-[10px] text-[var(--color-secondary-text)] block text-right mt-1">
                  {comment.length}/1000 characters
                </span>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{existingReview ? 'Update Review' : 'Submit Review'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
