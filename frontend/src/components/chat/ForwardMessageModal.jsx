import { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Forward,
  Loader2,
  Check,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { extractId } from '../../utils/chatUtils';

// Helper to safely extract participant name
const getParticipantName = (participant, fallback) => {
  if (!participant) return fallback;
  if (typeof participant === 'string') return fallback;
  return participant.name && participant.name.trim() ? participant.name.trim() : fallback;
};

export default function ForwardMessageModal() {
  const { user } = useAuth();
  const {
    forwardingMessage,
    setForwardingMessage,
    conversations = [],
    activeConversation,
    forwardMessage,
  } = useChat();

  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const searchInputRef = useRef(null);

  const isAdmin = user?.role === 'admin';
  const isOrganizer = user?.role === 'organizer';

  // Reset state whenever the modal opens with a new message
  useEffect(() => {
    if (forwardingMessage) {
      setSelectedConversationId(null);
      setSearchQuery('');
      setIsSubmitting(false);
      setErrorMessage('');
      setSuccessMessage('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [forwardingMessage]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && forwardingMessage && !isSubmitting) {
        setForwardingMessage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [forwardingMessage, isSubmitting, setForwardingMessage]);

  // Filter available authorized conversations
  const filteredConversations = useMemo(() => {
    if (!conversations || !Array.isArray(conversations)) return [];

    return conversations.filter((c) => {
      if (!c || !c._id) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const eventTitle = (c.eventId?.title || '').toLowerCase();

      let otherName = '';
      if (c.type === 'admin_organizer') {
        otherName = isAdmin
          ? getParticipantName(c.organizerId, 'Event Organizer')
          : 'Platform Admin';
      } else {
        otherName = isOrganizer
          ? getParticipantName(c.attendeeId, 'Attendee')
          : getParticipantName(c.organizerId, 'Event Organizer');
      }

      const lastText = (c.lastMessage?.text || '').toLowerCase();

      return (
        eventTitle.includes(q) ||
        otherName.toLowerCase().includes(q) ||
        lastText.includes(q)
      );
    });
  }, [conversations, searchQuery, isAdmin, isOrganizer]);

  if (!forwardingMessage) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    setForwardingMessage(null);
  };

  const handleConfirmForward = async () => {
    if (!selectedConversationId || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const sourceMsgId = extractId(forwardingMessage._id || forwardingMessage.id);
      const res = await forwardMessage(selectedConversationId, sourceMsgId);

      if (res && res.success) {
        setSuccessMessage('Message forwarded successfully!');
        setTimeout(() => {
          setForwardingMessage(null);
        }, 500);
      } else {
        setErrorMessage(res?.error || 'Failed to forward message. Please try again.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred while forwarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inspect attachment details for preview
  const primaryAttachment =
    forwardingMessage.attachment ||
    (forwardingMessage.attachments && forwardingMessage.attachments[0]) ||
    null;

  const isImage =
    primaryAttachment &&
    (primaryAttachment.resourceType === 'image' ||
      (primaryAttachment.mimeType && primaryAttachment.mimeType.startsWith('image/')));

  const isDocument = primaryAttachment && !isImage;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-dark-panel)]/80 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forward-dialog-title"
      onClick={handleClose}
    >
      <div
        className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative text-[var(--color-main-text)] max-h-[90vh] flex flex-col animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--color-borders)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)] flex items-center justify-center shrink-0">
              <Forward className="w-5 h-5" />
            </div>
            <div>
              <h2 id="forward-dialog-title" className="font-extrabold text-base font-serif">
                Forward Message
              </h2>
              <p className="text-xs text-[var(--color-secondary-text)]">
                Select a conversation to share this message
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-[var(--color-primary-bg)] border border-[var(--color-borders)] flex items-center justify-center text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Preview Banner */}
        <div className="p-3 sm:p-4 bg-[var(--color-secondary-bg)]/60 border-b border-[var(--color-borders)] shrink-0">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-secondary-text)] block mb-1.5">
            Forwarding Content Preview:
          </span>
          <div className="p-3 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] shadow-2xs space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-secondary-text)]">
              <span className="font-bold text-[var(--color-primary-action)]">
                {forwardingMessage.senderName || 'Participant'}
              </span>
              {forwardingMessage.senderRole && (
                <span className="text-[9px] uppercase tracking-wider opacity-75">
                  ({forwardingMessage.senderRole})
                </span>
              )}
            </div>

            {/* Text Preview */}
            {forwardingMessage.text && (
              <p className="text-xs text-[var(--color-main-text)] leading-relaxed max-h-24 overflow-y-auto whitespace-pre-wrap break-words">
                {forwardingMessage.text}
              </p>
            )}

            {/* Attachment Preview */}
            {primaryAttachment && (
              <div className="pt-1">
                {isImage ? (
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)]">
                    <img
                      src={primaryAttachment.url}
                      alt={primaryAttachment.originalName || 'Attached image'}
                      className="w-12 h-12 rounded-lg object-cover bg-black/10 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-main-text)] truncate">
                        <ImageIcon className="w-3.5 h-3.5 text-[var(--color-primary-action)] shrink-0" />
                        <span className="truncate">{primaryAttachment.originalName || 'Image'}</span>
                      </div>
                      <span className="text-[10px] text-[var(--color-secondary-text)]">Image attachment</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)]">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-[var(--color-main-text)] truncate">
                        {primaryAttachment.originalName || 'Document attachment'}
                      </p>
                      <span className="text-[10px] text-[var(--color-secondary-text)]">
                        {primaryAttachment.fileSize ? `${Math.round(primaryAttachment.fileSize / 1024)} KB` : 'Document'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Search Box */}
        <div className="p-3 sm:px-4 border-b border-[var(--color-borders)] shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-secondary-text)] pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations by event or person..."
              aria-label="Search destination conversations"
              className="w-full pl-8 pr-8 py-2 rounded-xl bg-[var(--color-primary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] placeholder-[var(--color-secondary-text)] focus:outline-hidden focus:border-[var(--color-primary-action)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)]/20 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div
          role="radiogroup"
          aria-label="Select destination conversation"
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 divide-y-0"
        >
          {filteredConversations.length === 0 ? (
            <div className="py-8 text-center text-[var(--color-secondary-text)] space-y-2">
              <MessageSquare className="w-7 h-7 mx-auto opacity-40 mb-1" />
              <p className="text-xs font-bold text-[var(--color-main-text)]">
                {searchQuery.trim() ? 'No matching conversations' : 'No conversations available'}
              </p>
              <p className="text-[11px] max-w-xs mx-auto leading-relaxed">
                {searchQuery.trim()
                  ? `No conversations match "${searchQuery.trim()}".`
                  : 'You do not have any other active conversations to forward to.'}
              </p>
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isSelected = selectedConversationId === c._id;
              const isCurrent = activeConversation && extractId(activeConversation._id) === extractId(c._id);
              const event = c.eventId || {};

              let otherParticipantName = 'Participant';
              if (c.type === 'admin_organizer') {
                otherParticipantName = isAdmin
                  ? getParticipantName(c.organizerId, 'Event Organizer')
                  : 'Platform Admin';
              } else {
                otherParticipantName = isOrganizer
                  ? getParticipantName(c.attendeeId, 'Attendee')
                  : getParticipantName(c.organizerId, 'Event Organizer');
              }

              return (
                <div
                  key={c._id}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => setSelectedConversationId(c._id)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setSelectedConversationId(c._id);
                    }
                  }}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'border-[var(--color-primary-action)] bg-[var(--color-primary-action)]/10 shadow-xs'
                      : 'border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)]/70'
                  }`}
                >
                  {/* Selection Radio / Checkmark */}
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? 'border-[var(--color-primary-action)] bg-[var(--color-primary-action)] text-white shadow-2xs'
                        : 'border-[var(--color-borders)] bg-[var(--color-card-bg)]'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>

                  {/* Avatar Initial */}
                  <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-action)]/15 border border-[var(--color-primary-action)]/20 text-[var(--color-primary-action)] font-black text-xs flex items-center justify-center shrink-0">
                    {otherParticipantName ? otherParticipantName[0].toUpperCase() : 'U'}
                  </div>

                  {/* Conversation Meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-[var(--color-main-text)] truncate">
                        {otherParticipantName}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-secondary-bg)] text-[var(--color-secondary-text)] border border-[var(--color-borders)] shrink-0">
                          Current Chat
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--color-primary-action)] font-semibold truncate">
                      {event.title || 'Event Chat'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Feedback / Error state */}
        {errorMessage && (
          <div className="px-4 py-2.5 bg-red-500/10 border-t border-red-500/20 text-red-500 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="px-4 py-2.5 bg-emerald-500/10 border-t border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2 shrink-0">
            <Check className="w-4 h-4 shrink-0" />
            <span className="flex-1">{successMessage}</span>
          </div>
        )}

        {/* Modal Actions Footer */}
        <div className="p-4 sm:p-5 border-t border-[var(--color-borders)] flex items-center justify-end gap-2 shrink-0 bg-[var(--color-card-bg)]">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmForward}
            disabled={!selectedConversationId || isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-primary-action)] text-white text-xs font-bold shadow-xs hover:opacity-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Forwarding...</span>
              </>
            ) : (
              <>
                <Forward className="w-3.5 h-3.5" />
                <span>Forward Message</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
