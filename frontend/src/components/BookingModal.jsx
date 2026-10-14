import { useNavigate } from 'react-router-dom';
import { X, Calendar, MapPin, QrCode, Ticket } from 'lucide-react';

export default function BookingModal({ event, onClose }) {
  const navigate = useNavigate();

  if (!event) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-dark-panel)]/75 backdrop-blur-xs animate-fade-in">
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative text-[var(--color-main-text)]">
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
        <div className="relative aspect-[21/9] bg-[var(--color-secondary-bg)] overflow-hidden">
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-dark-panel)]/85 via-[var(--color-dark-panel)]/30 to-transparent flex items-end p-4">
            <span className="bg-[var(--color-primary-action)] text-[var(--color-primary-text)] text-xs font-bold px-3 py-1 rounded-lg shadow-xs">
              {event.category}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <h3 className="font-extrabold text-xl text-[var(--color-main-text)] leading-snug font-serif">
              {event.title}
            </h3>
            <p className="text-xs text-[var(--color-secondary-text)] mt-1 leading-relaxed">
              {event.tagline}
            </p>
          </div>

          <div className="bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-xl p-3.5 space-y-2 text-xs text-[var(--color-secondary-text)]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--color-primary-action)]" />
              <span className="font-semibold text-[var(--color-main-text)]">
                {event.date} • {event.time}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[var(--color-golden-accent)]" />
              <span>{event.venue}</span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-borders)]/80">
              <Ticket className="w-4 h-4 text-[var(--color-primary-action)]" />
              <span className="font-bold text-[var(--color-main-text)]">
                Starting Price: {event.price}
              </span>
            </div>
          </div>

          {/* Sign-in prompt notice */}
          <div className="bg-[var(--color-accent-soft)] border border-[var(--color-primary-action)]/30 rounded-xl p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--color-primary-action)] font-bold text-xs uppercase tracking-wider">
              <QrCode className="w-4 h-4" />
              <span>Sign In Required for Digital Pass</span>
            </div>
            <p className="text-xs text-[var(--color-main-text)] leading-relaxed">
              To reserve your verified seat, receive your dynamic QR admission pass, and get stage notifications, sign in to your UTSAV account or register in seconds.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/login');
              }}
              className="flex-1 py-3 px-4 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-xs sm:text-sm rounded-xl transition-all text-center shadow-xs active:translate-y-0.5 cursor-pointer"
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
      </div>
    </div>
  );
}
