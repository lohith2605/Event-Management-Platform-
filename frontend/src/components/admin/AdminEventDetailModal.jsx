import { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Tag,
  Users,
  Ticket,
  User,
  Mail,
  Phone,
  ShieldCheck,
  AlertTriangle,
  Undo2,
  CheckCircle,
  XCircle,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export default function AdminEventDetailModal({
  event,
  bookingStats = {},
  isOpen,
  onClose,
  onApprove,
  onReject,
  onReturn,
  isProcessing = false,
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [returnMode, setReturnMode] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [validationError, setValidationError] = useState('');
  const { startOrOpenConversation } = useChat();

  if (!isOpen || !event) return null;

  const handleApprove = () => {
    onApprove(event._id, event.title);
  };

  const handleRejectSubmit = (e) => {
    e.preventDefault();
    if (!reasonText || !reasonText.trim()) {
      setValidationError('Please provide a specific rejection reason explaining why this submission was rejected.');
      return;
    }
    setValidationError('');
    onReject(event._id, reasonText.trim());
  };

  const handleReturnSubmit = (e) => {
    e.preventDefault();
    if (!reasonText || !reasonText.trim()) {
      setValidationError('Please provide clear correction instructions for the host to resolve.');
      return;
    }
    setValidationError('');
    onReturn(event._id, reasonText.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col text-[var(--color-main-text)]">
        {/* Header with thumbnail banner */}
        <div className="relative h-44 sm:h-52 w-full overflow-hidden shrink-0 bg-[var(--color-secondary-bg)]">
          <img
            src={event.image || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80'}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-xs transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Banner Badges */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-primary-action)] text-white shadow-xs">
                  {event.category}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-xs">
                  {event.format}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                    event.status === 'published'
                      ? 'bg-emerald-500 text-white'
                      : event.status === 'pending'
                      ? 'bg-amber-500 text-black font-extrabold'
                      : event.status === 'rejected'
                      ? 'bg-red-500 text-white'
                      : 'bg-zinc-600 text-white'
                  }`}
                >
                  Status: {event.status}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white font-serif line-clamp-1">
                {event.title}
              </h2>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xl sm:text-2xl font-black text-[var(--color-golden-accent)] drop-shadow-md">
                {event.priceNumber === 0 ? 'Free' : `₹${event.priceNumber}`}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Tagline */}
          {event.tagline && (
            <p className="text-sm font-semibold text-[var(--color-secondary-text)] italic">
              &ldquo;{event.tagline}&rdquo;
            </p>
          )}

          {/* Previous Rejection / Correction feedback notice */}
          {event.rejectionReason && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Recorded Feedback / Rejection Reason:</span>
              </div>
              <p className="text-[11px] leading-relaxed pl-6">
                {event.rejectionReason}
              </p>
            </div>
          )}

          {/* Event Schedule & Location Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)] rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-[var(--color-secondary-text)] font-semibold">
                <Calendar className="w-3.5 h-3.5 text-[var(--color-primary-action)]" />
                <span>Date & Time</span>
              </div>
              <p className="font-bold text-[var(--color-main-text)]">{event.date}</p>
              <p className="text-[10px] text-[var(--color-secondary-text)]">{event.time}</p>
            </div>

            <div className="p-3.5 bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)] rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-[var(--color-secondary-text)] font-semibold">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Venue & City</span>
              </div>
              <p className="font-bold text-[var(--color-main-text)] truncate">{event.venue}</p>
              <p className="text-[10px] text-[var(--color-secondary-text)]">{event.city}</p>
            </div>

            <div className="p-3.5 bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)] rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-[var(--color-secondary-text)] font-semibold">
                <Users className="w-3.5 h-3.5 text-[var(--color-golden-accent)]" />
                <span>Capacity & Spots</span>
              </div>
              <p className="font-bold text-[var(--color-main-text)]">
                {event.spotsLeft} spots available
              </p>
              <p className="text-[10px] text-[var(--color-secondary-text)]">
                Total venue cap: {event.totalCapacity}
              </p>
            </div>
          </div>

          {/* Organizer Profile Card */}
          <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl space-y-2">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-[var(--color-secondary-text)]">
              Host / Organizer Profile
            </span>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold">
                  {event.organizer ? event.organizer.charAt(0).toUpperCase() : 'O'}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[var(--color-main-text)]">
                    {event.organizer}
                  </h4>
                  <p className="text-[11px] text-[var(--color-secondary-text)]">
                    {event.organizerId?.email || 'Email not provided'} &bull; {event.organizerId?.phone || 'No phone'}
                  </p>
                </div>
              </div>

              {event.organizerId?.isSuspended && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/15 text-red-600 border border-red-500/30">
                  Organizer Account Suspended
                </span>
              )}
            </div>
            {event.organizerId?.bio && (
              <p className="text-[11px] text-[var(--color-secondary-text)] pt-1 border-t border-[var(--color-borders)]/40 italic">
                &ldquo;{event.organizerId.bio}&rdquo;
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--color-secondary-text)]">
              Event Description & Schedule
            </h3>
            <div className="p-4 bg-[var(--color-secondary-bg)]/30 border border-[var(--color-borders)] rounded-2xl whitespace-pre-wrap leading-relaxed text-[var(--color-main-text)]">
              {event.description || 'No detailed description provided by the host.'}
            </div>
          </div>

          {/* Ticket Tiers Breakdown */}
          {Array.isArray(event.ticketTiers) && event.ticketTiers.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--color-secondary-text)]">
                Configured Ticket Tiers ({event.ticketTiers.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {event.ticketTiers.map((tier, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)] rounded-xl space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-[var(--color-main-text)]">{tier.name}</span>
                      <span className="text-[var(--color-primary-action)]">
                        {tier.price === 0 ? 'Free' : `₹${tier.price}`}
                      </span>
                    </div>
                    <div className="text-[10px] text-[var(--color-secondary-text)] flex justify-between">
                      <span>Spots Left: {tier.spotsLeft}</span>
                      <span>Capacity: {tier.capacity}</span>
                    </div>
                    {tier.description && (
                      <p className="text-[10px] text-[var(--color-secondary-text)] pt-1 border-t border-[var(--color-borders)]/30 italic">
                        {tier.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {Array.isArray(event.tags) && event.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-[var(--color-secondary-text)] uppercase">Tags:</span>
              {event.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--color-secondary-bg)] text-[var(--color-secondary-text)] border border-[var(--color-borders)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Action Modals / Inlines for Reject and Return */}
          {rejectMode && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-red-700 dark:text-red-400 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  <span>State Rejection Reason (Mandatory)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setRejectMode(false)}
                  className="text-xs text-[var(--color-secondary-text)] hover:underline"
                >
                  Cancel
                </button>
              </div>

              <textarea
                value={reasonText}
                onChange={(e) => {
                  setReasonText(e.target.value);
                  setValidationError('');
                }}
                rows={3}
                placeholder="Explain why this submission does not meet UTSAV quality, safety, or legal standards..."
                className="w-full p-2.5 rounded-xl text-xs bg-[var(--color-input-bg)] border border-red-300 dark:border-red-900/50 text-[var(--color-main-text)] focus:outline-hidden"
              />

              {validationError && (
                <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold">{validationError}</p>
              )}

              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={isProcessing}
                className="w-full py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
              >
                {isProcessing ? 'Recording Rejection...' : 'Confirm Rejection'}
              </button>
            </div>
          )}

          {returnMode && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Undo2 className="w-4 h-4" />
                  <span>Instructions for Host Adjustments (Mandatory)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setReturnMode(false)}
                  className="text-xs text-[var(--color-secondary-text)] hover:underline"
                >
                  Cancel
                </button>
              </div>

              <textarea
                value={reasonText}
                onChange={(e) => {
                  setReasonText(e.target.value);
                  setValidationError('');
                }}
                rows={3}
                placeholder="Specify what details the organizer needs to correct (e.g. clarify venue address, upload higher quality poster, adjust ticket tier pricing)..."
                className="w-full p-2.5 rounded-xl text-xs bg-[var(--color-input-bg)] border border-amber-300 dark:border-amber-900/50 text-[var(--color-main-text)] focus:outline-hidden"
              />

              {validationError && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">{validationError}</p>
              )}

              <button
                type="button"
                onClick={handleReturnSubmit}
                disabled={isProcessing}
                className="w-full py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
              >
                {isProcessing ? 'Returning to Host...' : 'Confirm Return for Corrections'}
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 bg-[var(--color-secondary-bg)]/50 border-t border-[var(--color-borders)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-[var(--color-secondary-text)]">
            ID: <span className="font-mono">{event._id}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
            >
              Close
            </button>

            {!rejectMode && !returnMode && (
              <>
                {event.status === 'published' && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      startOrOpenConversation({
                        eventId: event._id,
                        type: 'admin_organizer',
                        autoOpenDrawer: true,
                      });
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Direct chat with event organizer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Organizer Chat</span>
                  </button>
                )}

                {event.status !== 'published' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setReasonText('');
                        setValidationError('');
                        setReturnMode(true);
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-colors cursor-pointer"
                    >
                      Return for Corrections
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setReasonText('');
                        setValidationError('');
                        setRejectMode(true);
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 transition-colors cursor-pointer"
                    >
                      Reject Event
                    </button>

                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isProcessing}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{isProcessing ? 'Approving...' : 'Approve & Publish'}</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
