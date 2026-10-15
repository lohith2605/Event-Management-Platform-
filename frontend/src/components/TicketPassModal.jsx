import { X, Calendar, MapPin, Printer, ShieldCheck, Ticket } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function TicketPassModal({ ticket, onClose }) {
  if (!ticket) return null;

  const event = ticket.eventId || {};
  const booking = ticket.bookingId || {};

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-dark-panel)]/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative text-[var(--color-main-text)] max-h-[95vh] flex flex-col">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-[var(--color-primary-bg)]/90 border border-[var(--color-borders)] flex items-center justify-center text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer"
          aria-label="Close pass"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Printable Ticket Pass Container */}
        <div className="p-6 space-y-6 overflow-y-auto" id="printable-ticket">
          {/* Header branding */}
          <div className="text-center pb-2 border-b border-[var(--color-borders)]">
            <span className="font-serif font-extrabold text-2xl tracking-wider text-[var(--color-primary-action)]">
              UTSAV
            </span>
            <p className="text-[11px] uppercase tracking-widest text-[var(--color-secondary-text)] font-semibold mt-0.5">
              Official Digital Admission Pass
            </p>
          </div>

          {/* Event Card preview */}
          <div className="bg-[var(--color-secondary-bg)] rounded-2xl p-4 border border-[var(--color-borders)] space-y-3">
            <div className="flex items-start gap-3">
              {event.image && (
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-16 h-16 rounded-xl object-cover border border-[var(--color-borders)] shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-golden-accent)]">
                  {event.category || 'Event'}
                </span>
                <h4 className="font-bold text-sm text-[var(--color-main-text)] leading-snug truncate">
                  {event.title}
                </h4>
                <p className="text-[11px] text-[var(--color-secondary-text)] mt-0.5 truncate">
                  {event.venue}, {event.city}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--color-borders)]/80 text-xs">
              <div>
                <span className="text-[10px] text-[var(--color-secondary-text)] block">Date & Time</span>
                <span className="font-semibold text-[var(--color-main-text)]">{event.date}</span>
                <span className="text-[11px] text-[var(--color-secondary-text)] block">{event.time}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-secondary-text)] block">Attendee</span>
                <span className="font-semibold text-[var(--color-main-text)] truncate block">
                  {ticket.attendeeName}
                </span>
                <span className="text-[10px] font-mono text-[var(--color-primary-action)] block">
                  Seat: {ticket.seatNumber || 'GA'}
                </span>
              </div>
            </div>
          </div>

          {/* Secure QR Code Section */}
          <div className="bg-white p-5 rounded-2xl border-2 border-dashed border-[var(--color-borders)] text-center space-y-3 shadow-inner">
            <div className="inline-block p-2 bg-white rounded-xl shadow-xs">
              <QRCodeSVG
                value={ticket.qrData}
                size={160}
                level="M"
                includeMargin={false}
              />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-gray-800 tracking-wider block">
                {ticket.ticketCode}
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">
                Ref: {ticket.bookingReference}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Digital Admission Pass</span>
            </div>
          </div>

          {/* Verification terms */}
          <div className="text-[11px] text-[var(--color-secondary-text)] space-y-1 text-center">
            <p>Present this dynamic QR pass at the registration desk for venue check-in.</p>
            <p className="text-[10px] opacity-75">
              Pass is non-transferable and subject to UTSAV admission terms.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 py-2.5 px-4 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save Pass</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-[var(--color-main-text)] font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
