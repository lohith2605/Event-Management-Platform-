import { useState, useRef, useEffect } from 'react';
import {
  Check,
  CheckCheck,
  Smile,
  Plus,
  Pencil,
  Trash2,
  Ban,
  X,
  AlertCircle,
  Download,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  Loader2,
  Reply,
  Forward,
  Pin,
  PinOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { extractId, getOtherParticipantId } from '../../utils/chatUtils';

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getDocDetails = (attachment, isOwn) => {
  const name = attachment?.originalName || '';
  const ext = name.split('.').pop().toLowerCase();
  const mime = (attachment?.mimeType || '').toLowerCase();

  if (ext === 'pdf' || mime === 'application/pdf') {
    return {
      Icon: FileText,
      label: 'PDF',
      isPdf: true,
      bgClass: isOwn ? 'bg-white/20 text-white' : 'bg-red-500/10 text-red-500 border-red-500/20',
    };
  }
  if (
    ext === 'xlsx' ||
    ext === 'csv' ||
    mime.includes('csv') ||
    mime.includes('spreadsheet')
  ) {
    return {
      Icon: FileSpreadsheet,
      label: ext.toUpperCase() || 'XLS',
      isPdf: false,
      bgClass: isOwn
        ? 'bg-white/20 text-white'
        : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    };
  }
  if (ext === 'docx' || mime.includes('word')) {
    return {
      Icon: FileText,
      label: 'DOC',
      isPdf: false,
      bgClass: isOwn ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    };
  }
  return {
    Icon: FileText,
    label: ext.toUpperCase() || 'TXT',
    isPdf: false,
    bgClass: isOwn
      ? 'bg-white/20 text-white'
      : 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  };
};

const QUICK_EMOJIS = ['👍', '❤️', '🎉', '😂', '😮', '🙏'];

// Aggregates array of reactions into unique emojis with count, reactedByMe, and names
const aggregateReactions = (reactions = [], currentUserId) => {
  if (!Array.isArray(reactions) || reactions.length === 0) return [];
  const map = new Map();

  reactions.forEach((r) => {
    if (!r || !r.emoji) return;
    const rUserIdStr = extractId(r.userId || r.user);
    const isMe = Boolean(currentUserId && rUserIdStr && rUserIdStr === currentUserId);
    const name = isMe ? 'You' : r.userName || 'Participant';

    if (!map.has(r.emoji)) {
      map.set(r.emoji, {
        emoji: r.emoji,
        count: 1,
        hasReacted: isMe,
        users: [name],
      });
    } else {
      const entry = map.get(r.emoji);
      entry.count += 1;
      if (isMe) entry.hasReacted = true;
      entry.users.push(name);
    }
  });

  return Array.from(map.values());
};

export default function MessageBubble({ message, isOwn, otherParticipantId }) {
  const { user } = useAuth();
  const {
    toggleReaction,
    editMessage,
    deleteMessage,
    downloadAttachment,
    activeConversation,
    highlightedMessageId,
    jumpToMessage,
    setReplyingTo,
    setForwardingMessage,
    pinMessage,
    unpinMessage,
  } = useChat();

  const [showPicker, setShowPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message?.text || '');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [jumpError, setJumpError] = useState('');
  const [isPinning, setIsPinning] = useState(false);
  const [pinError, setPinError] = useState('');

  const pickerRef = useRef(null);
  const editInputRef = useRef(null);
  const selectingEmojiRef = useRef(false);

  const attachment =
    message?.attachment ||
    (Array.isArray(message?.attachments) && message.attachments.length > 0
      ? message.attachments[0]
      : null);

  // Sync editText if message.text changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditText(message?.text || '');
    }
  }, [message?.text, isEditing]);

  // Auto-focus and adjust height on entering edit mode
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(
        editInputRef.current.value.length,
        editInputRef.current.value.length
      );
    }
  }, [isEditing]);

  // Close picker, lightbox, or delete modal on outside click or Escape key
  useEffect(() => {
    if (!showPicker && !showDeleteConfirm && !showLightbox) return;

    const handleOutsideClick = (e) => {
      if (showPicker && pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowPicker(false);
        setShowLightbox(false);
        if (!isDeleting) {
          setShowDeleteConfirm(false);
        }
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPicker, showDeleteConfirm, showLightbox, isDeleting]);

  if (!message) return null;

  // Format readable timestamp
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Determine read receipt status
  const isReadByRecipient = () => {
    if (!isOwn || !message.readBy || message.isDeleted) return false;
    const recipientId = otherParticipantId || getOtherParticipantId(activeConversation, user);
    if (recipientId) {
      return message.readBy.some(
        (r) => extractId(r.userId || r.user) === extractId(recipientId)
      );
    }
    const senderIdStr = extractId(message.senderId);
    return message.readBy.some((r) => {
      const readerIdStr = extractId(r.userId || r.user);
      return readerIdStr && readerIdStr !== senderIdStr;
    });
  };

  const read = isReadByRecipient();
  const currentUserId = extractId(user?._id || user?.id || user);
  const targetMsgId = extractId(message?._id || message?.id);
  const aggregatedReactions = aggregateReactions(message?.reactions, currentUserId);
  const isHighlighted = Boolean(
    highlightedMessageId && extractId(highlightedMessageId) === targetMsgId
  );
  const pinnedMsgId = extractId(activeConversation?.pinnedMessage?.messageId);
  const isPinned = Boolean(
    message?.isPinned || (pinnedMsgId && pinnedMsgId === targetMsgId)
  );

  const handleTogglePin = async () => {
    if (isPinning || !targetMsgId || message.isDeleted) return;
    try {
      setIsPinning(true);
      setPinError('');
      if (isPinned) {
        if (unpinMessage) {
          const res = await unpinMessage(targetMsgId);
          if (res && res.error) {
            setPinError(res.error);
            setTimeout(() => setPinError(''), 4000);
          }
        }
      } else {
        if (pinMessage) {
          const res = await pinMessage(targetMsgId);
          if (res && res.error) {
            setPinError(res.error);
            setTimeout(() => setPinError(''), 4000);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to toggle pin:', err);
      setPinError(err.message || 'Failed to update pin');
      setTimeout(() => setPinError(''), 4000);
    } finally {
      setIsPinning(false);
    }
  };

  const handleSelectEmoji = (emoji) => {
    setShowPicker(false);
    if (selectingEmojiRef.current) return;
    selectingEmojiRef.current = true;
    setTimeout(() => {
      selectingEmojiRef.current = false;
    }, 300);

    if (toggleReaction && targetMsgId) {
      toggleReaction(targetMsgId, emoji);
    }
  };

  const handleStartEdit = () => {
    if (message.isDeleted) return;
    setEditText(message.text || '');
    setEditError('');
    setIsEditing(true);
    setShowPicker(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(message.text || '');
    setEditError('');
  };

  const handleSaveEdit = async () => {
    const trimmed = editText.trim();
    const hasAttachments = Boolean(attachment && attachment.url);

    if (!trimmed && !hasAttachments) {
      setEditError('Message cannot be empty.');
      return;
    }
    if (trimmed.length > 2000) {
      setEditError('Message cannot exceed 2000 characters.');
      return;
    }

    // No-op if unchanged
    if (trimmed === (message.text || '')) {
      setIsEditing(false);
      setEditError('');
      return;
    }

    try {
      setIsSavingEdit(true);
      setEditError('');
      const res = await editMessage(targetMsgId, trimmed);
      if (res && res.success) {
        setIsEditing(false);
      } else if (res && res.error) {
        setEditError(res.error);
      }
    } catch (err) {
      setEditError(err.message || 'Failed to save edit.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      const res = await deleteMessage(targetMsgId);
      if (res && res.success) {
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      console.warn('Failed to delete message:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const isImageAttachment =
    attachment &&
    Boolean(
      attachment.resourceType === 'image' ||
        (attachment.mimeType && attachment.mimeType.startsWith('image/'))
    );

  const handleDownload = async (action = 'download') => {
    if (!attachment || !attachment.url) return;
    const convId = extractId(message.conversationId) || extractId(activeConversation?._id);
    if (!convId || !targetMsgId) return;

    try {
      setIsDownloading(true);
      setDownloadError('');
      if (downloadAttachment) {
        await downloadAttachment(convId, targetMsgId, attachment.originalName, action);
      }
    } catch (err) {
      setDownloadError(err.message || 'Download failed.');
      setTimeout(() => setDownloadError(''), 4000);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleJumpToOriginal = async () => {
    const targetId = message.replySnapshot?.messageId || message.replyToMessageId;
    if (!targetId || !jumpToMessage) return;
    try {
      const res = await jumpToMessage(targetId);
      if (res && res.error) {
        setJumpError(res.error);
        setTimeout(() => setJumpError(''), 3500);
      }
    } catch (err) {
      setJumpError(err.message || 'Original message is unavailable.');
      setTimeout(() => setJumpError(''), 3500);
    }
  };

  return (
    <div
      id={`chat-message-${targetMsgId}`}
      className={`flex flex-col mb-3 group scroll-mt-16 transition-all duration-300 rounded-2xl ${
        isOwn ? 'items-end' : 'items-start'
      }`}
    >
      {/* Sender name on incoming message */}
      {!isOwn && (
        <span className="text-[10px] font-bold text-[var(--color-secondary-text)] mb-1 px-1">
          {message.senderName || 'Participant'}
          {message.senderRole && (
            <span className="ml-1 text-[9px] uppercase tracking-wider opacity-75 font-semibold">
              ({message.senderRole})
            </span>
          )}
        </span>
      )}

      {/* Bubble Row with Quick Action Bar */}
      <div
        className={`relative flex items-center gap-1.5 max-w-[85%] sm:max-w-[75%] md:max-w-[70%] ${
          isOwn ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* Message bubble */}
        <div
          className={`w-full rounded-2xl px-4 py-2.5 shadow-xs text-xs sm:text-sm break-words [word-break:break-word] [overflow-wrap:anywhere] leading-relaxed transition-all duration-300 ${
            isHighlighted
              ? 'ring-3 ring-[var(--color-primary-action)] ring-offset-2 ring-offset-[var(--color-card-bg)] shadow-lg animate-pulse scale-[1.01]'
              : ''
          } ${
            message.isDeleted
              ? 'bg-[var(--color-card-bg)] text-[var(--color-secondary-text)] border border-[var(--color-borders)]/60 italic rounded-br-xs'
              : isOwn
              ? 'bg-[var(--color-primary-action)] text-white rounded-br-xs'
              : 'bg-[var(--color-card-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] rounded-bl-xs'
          }`}
        >
          {/* Deleted message placeholder */}
          {message.isDeleted ? (
            <div className="flex items-center gap-1.5 py-0.5">
              <Ban className="w-3.5 h-3.5 opacity-60 shrink-0" aria-hidden="true" />
              <span>This message was deleted</span>
            </div>
          ) : isEditing ? (
            /* Inline editing mode */
            <div className="w-full min-w-[200px] sm:min-w-[240px]">
              <textarea
                ref={editInputRef}
                value={editText}
                onChange={(e) => {
                  setEditText(e.target.value);
                  if (editError) setEditError('');
                }}
                onKeyDown={handleEditKeyDown}
                disabled={isSavingEdit}
                rows={Math.min(6, Math.max(2, (editText.match(/\n/g) || []).length + 1))}
                maxLength={2000}
                className={`w-full text-xs sm:text-sm p-2 rounded-xl resize-none focus:outline-hidden ${
                  isOwn
                    ? 'bg-black/15 text-white placeholder-white/60 border border-white/20 focus:border-white focus:ring-1 focus:ring-white/40'
                    : 'bg-[var(--color-secondary-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:ring-1 focus:ring-[var(--color-primary-action)]'
                }`}
                aria-label="Edit message"
              />
              {editError && (
                <p className="text-[10px] text-red-200 font-medium mt-1">{editError}</p>
              )}
              <div className="flex items-center justify-end gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSavingEdit}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    isOwn
                      ? 'text-white/80 hover:text-white hover:bg-white/10'
                      : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold shadow-xs transition-opacity cursor-pointer ${
                    isOwn
                      ? 'bg-white text-[var(--color-primary-action)] hover:bg-white/95 disabled:opacity-50'
                      : 'bg-[var(--color-primary-action)] text-white hover:opacity-90 disabled:opacity-50'
                  }`}
                >
                  {isSavingEdit ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Active message rendering */
            <div className="flex flex-col">
              {/* Pinned Indicator Badge */}
              {isPinned && (
                <div
                  className={`inline-flex items-center gap-1 mb-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide self-start ${
                    isOwn
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  }`}
                  title="This message is pinned in the conversation"
                  aria-label="Pinned message"
                >
                  <Pin className="w-2.5 h-2.5 rotate-45 shrink-0" />
                  <span>Pinned message</span>
                </div>
              )}

              {/* Forwarded Indicator Badge */}
              {message.isForwarded && (
                <div
                  className={`flex items-center gap-1 mb-1 text-[11px] font-semibold italic ${
                    isOwn ? 'text-white/80' : 'text-[var(--color-secondary-text)]'
                  }`}
                >
                  <Forward className="w-3 h-3 shrink-0 not-italic" />
                  <span>Forwarded</span>
                  {message.forwardedFromSenderName && (
                    <span className="not-italic font-normal opacity-90 truncate max-w-[160px] sm:max-w-[220px]">
                      from {message.forwardedFromSenderName}
                    </span>
                  )}
                </div>
              )}

              {/* Quoted Reply Preview Banner (Clickable to jump) */}
              {(message.replySnapshot || message.replyToMessageId) && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleJumpToOriginal();
                  }}
                  className={`mb-2 p-2 rounded-xl text-left transition-all cursor-pointer select-none group/reply ${
                    isOwn
                      ? 'bg-black/20 hover:bg-black/30 text-white border-l-4 border-l-white/80'
                      : 'bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)]/50 text-[var(--color-main-text)] border border-[var(--color-borders)] border-l-4 border-l-[var(--color-primary-action)]'
                  }`}
                  title="Click to jump to original message"
                  aria-label="Click to jump to original message"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleJumpToOriginal();
                    }
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Reply className={`w-3 h-3 shrink-0 ${isOwn ? 'text-white/80' : 'text-[var(--color-primary-action)]'}`} />
                    <span
                      className={`text-[11px] font-bold truncate max-w-[170px] sm:max-w-xs ${
                        isOwn ? 'text-white' : 'text-[var(--color-primary-action)]'
                      }`}
                    >
                      {message.replySnapshot?.senderName || 'Original message'}
                    </span>
                    {message.replySnapshot?.senderRole && (
                      <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75">
                        ({message.replySnapshot.senderRole})
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs truncate max-w-[200px] sm:max-w-sm ${
                      isOwn ? 'text-white/80' : 'text-[var(--color-secondary-text)]'
                    }`}
                  >
                    {message.replySnapshot?.isDeleted ? (
                      <span className="italic flex items-center gap-1 opacity-75">
                        <Ban className="w-3 h-3 shrink-0 inline" />
                        Original message was deleted
                      </span>
                    ) : message.replySnapshot?.text ? (
                      message.replySnapshot.text
                    ) : message.replySnapshot?.hasAttachment ? (
                      message.replySnapshot.attachmentType === 'document' ? (
                        `📄 ${message.replySnapshot.originalName || 'Document'}`
                      ) : (
                        '📷 Image'
                      )
                    ) : (
                      'View message'
                    )}
                  </p>
                </div>
              )}

              {/* Jump Error Notification if original cannot be reached */}
              {jumpError && (
                <div className="mb-2 px-2 py-1 text-[10px] text-amber-200 bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center gap-1 animate-fade-in">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span className="truncate">{jumpError}</span>
                </div>
              )}

              {/* Pin Error Notification if pin/unpin failed */}
              {pinError && (
                <div className="mb-2 px-2 py-1 text-[10px] text-red-200 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-1 animate-fade-in">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span className="truncate">{pinError}</span>
                </div>
              )}

              {/* Attachment if present and not deleted */}
              {attachment && attachment.url && (
                <>
                  {isImageAttachment ? (
                    /* Image Attachment Rendering */
                    <div className="relative group/img mb-2 overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20">
                      {!imageError ? (
                        <>
                          <img
                            src={attachment.url}
                            alt={attachment.originalName || 'Image attachment'}
                            loading="lazy"
                            onClick={() => setShowLightbox(true)}
                            onError={() => setImageError(true)}
                            className="max-h-64 sm:max-h-72 w-auto max-w-full rounded-xl object-contain cursor-zoom-in transition-opacity hover:opacity-95"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload('download');
                            }}
                            disabled={isDownloading}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs opacity-80 sm:opacity-0 group-hover/img:opacity-100 focus:opacity-100 transition-opacity cursor-pointer shadow-sm"
                            title="Download original image"
                            aria-label="Download image"
                          >
                            {isDownloading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </>
                      ) : (
                        <div className="p-3 text-xs italic opacity-75 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Image could not be loaded</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Document Attachment Card Rendering */
                    (() => {
                      const { Icon, label, isPdf, bgClass } = getDocDetails(attachment, isOwn);
                      return (
                        <div
                          className={`mb-2 p-2.5 rounded-xl flex items-center justify-between gap-3 ${
                            isOwn
                              ? 'bg-white/10 border border-white/20 text-white'
                              : 'bg-[var(--color-secondary-bg)]/80 border border-[var(--color-borders)] text-[var(--color-main-text)]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 border ${bgClass}`}
                            >
                              <Icon className="w-5 h-5" />
                              <span className="text-[8px] font-bold tracking-wider uppercase mt-0.5">
                                {label}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p
                                className="text-xs font-semibold truncate max-w-[170px] sm:max-w-[220px]"
                                title={attachment.originalName}
                              >
                                {attachment.originalName || 'Document'}
                              </p>
                              <p
                                className={`text-[10px] mt-0.5 ${
                                  isOwn ? 'text-white/70' : 'text-[var(--color-secondary-text)]'
                                }`}
                              >
                                {formatFileSize(attachment.size)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isPdf && (
                              <button
                                type="button"
                                onClick={() => handleDownload('open')}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isOwn
                                    ? 'bg-white/15 hover:bg-white/25 text-white'
                                    : 'bg-[var(--color-card-bg)] hover:bg-[var(--color-borders)] text-[var(--color-main-text)] border border-[var(--color-borders)]'
                                }`}
                                title="Open PDF in new tab"
                                aria-label="Open PDF"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDownload('download')}
                              disabled={isDownloading}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isOwn
                                  ? 'bg-white/15 hover:bg-white/25 text-white'
                                  : 'bg-[var(--color-card-bg)] hover:bg-[var(--color-borders)] text-[var(--color-main-text)] border border-[var(--color-borders)]'
                              }`}
                              title="Download attachment"
                              aria-label="Download attachment"
                            >
                              {isDownloading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  )}

                  {/* Download Error Indicator if any */}
                  {downloadError && (
                    <div className="mb-2 px-2 py-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-1 animate-fade-in">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span className="truncate">{downloadError}</span>
                    </div>
                  )}
                </>
              )}

              {/* Message text / caption */}
              {message.text && (
                <div className="whitespace-pre-wrap break-words [word-break:break-word] [overflow-wrap:anywhere]">
                  {message.text}
                </div>
              )}
            </div>
          )}

          {/* Timestamp, edited badge, and delivery receipts */}
          {!isEditing && (
            <div
              className={`flex items-center justify-end gap-1 mt-1 text-[10px] select-none font-medium ${
                message.isDeleted
                  ? 'text-[var(--color-secondary-text)] opacity-70'
                  : isOwn
                  ? 'text-white/80'
                  : 'text-[var(--color-secondary-text)]'
              }`}
            >
              {/* Edited indicator */}
              {message.isEdited && !message.isDeleted && (
                <span
                  title={
                    message.editedAt
                      ? `Edited ${formatTime(message.editedAt)}`
                      : 'Edited'
                  }
                  className="italic opacity-80 mr-0.5"
                >
                  (edited)
                </span>
              )}

              {formatTime(message.createdAt) && (
                <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
              )}

              {isOwn && !message.isDeleted && (
                <span
                  title={read ? 'Read by recipient' : 'Sent and delivered'}
                  aria-label={read ? 'Read by recipient' : 'Sent and delivered'}
                >
                  {read ? (
                    <CheckCheck className="w-3.5 h-3.5 text-cyan-200" aria-hidden="true" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-white/70" aria-hidden="true" />
                  )}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Reaction Picker Popover */}
        {showPicker && !message.isDeleted && (
          <div
            ref={pickerRef}
            onMouseDown={(e) => e.stopPropagation()}
            className={`absolute z-30 bottom-full mb-1 flex items-center gap-1 p-1 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-full shadow-lg ${
              isOwn ? 'right-0' : 'left-0'
            }`}
            role="menu"
            aria-label="Emoji Reactions"
          >
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelectEmoji(emoji);
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelectEmoji(emoji);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--color-secondary-bg)] hover:scale-125 transition-transform text-sm cursor-pointer select-none"
                title={`React with ${emoji}`}
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Hover / tap message actions bar (only for active messages) */}
        {!message.isDeleted && !isEditing && (
          <div
            className={`flex items-center gap-0.5 shrink-0 transition-opacity duration-150 ${
              showPicker
                ? 'opacity-100'
                : 'opacity-70 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100'
            }`}
          >
            {/* Reply action button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (setReplyingTo) {
                  setReplyingTo(message);
                }
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--color-secondary-text)] hover:text-[var(--color-primary-action)] hover:bg-[var(--color-primary-action)]/10 transition-colors cursor-pointer"
              title="Reply to message"
              aria-label="Reply to message"
            >
              <Reply className="w-3 h-3" />
            </button>

            {/* Forward action button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (setForwardingMessage) {
                  setForwardingMessage(message);
                }
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--color-secondary-text)] hover:text-[var(--color-primary-action)] hover:bg-[var(--color-primary-action)]/10 transition-colors cursor-pointer"
              title="Forward message"
              aria-label="Forward message"
            >
              <Forward className="w-3 h-3" />
            </button>

            {/* Pin / Unpin action button */}
            <button
              type="button"
              disabled={isPinning}
              onClick={(e) => {
                e.stopPropagation();
                handleTogglePin();
              }}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isPinned
                  ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
                  : 'text-[var(--color-secondary-text)] hover:text-amber-500 hover:bg-amber-500/10'
              }`}
              title={isPinned ? 'Unpin message' : 'Pin message'}
              aria-label={isPinned ? 'Unpin message' : 'Pin message'}
            >
              {isPinning ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : isPinned ? (
                <PinOff className="w-3 h-3" />
              ) : (
                <Pin className="w-3 h-3" />
              )}
            </button>

            {/* Reaction button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowPicker((prev) => !prev);
              }}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer ${
                showPicker ? 'bg-[var(--color-secondary-bg)] text-[var(--color-main-text)]' : ''
              }`}
              title="Add reaction"
              aria-label="Add reaction"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>

            {/* Author actions: Edit and Delete */}
            {isOwn && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit();
                  }}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
                  title="Edit message"
                  aria-label="Edit message"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                    setShowPicker(false);
                  }}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--color-secondary-text)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Delete message"
                  aria-label="Delete message"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Reaction Display Pills below bubble (only for non-deleted messages) */}
      {!message.isDeleted && aggregatedReactions.length > 0 && (
        <div
          className={`flex flex-wrap items-center gap-1 mt-1 px-1 ${
            isOwn ? 'justify-end' : 'justify-start'
          }`}
        >
          {aggregatedReactions.map((item) => (
            <button
              key={item.emoji}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (toggleReaction && targetMsgId) {
                  toggleReaction(targetMsgId, item.emoji);
                }
              }}
              title={item.users.join(', ')}
              aria-label={`${item.count} reaction${item.count > 1 ? 's' : ''} with ${item.emoji}. ${
                item.hasReacted ? 'Click to remove your reaction' : 'Click to add your reaction'
              }`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors cursor-pointer border select-none ${
                item.hasReacted
                  ? 'bg-[var(--color-primary-action)]/15 border-[var(--color-primary-action)] text-[var(--color-primary-action)] font-semibold'
                  : 'bg-[var(--color-card-bg)] border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:bg-[var(--color-secondary-bg)] hover:text-[var(--color-main-text)]'
              }`}
            >
              <span className="text-xs leading-none">{item.emoji}</span>
              <span className="text-[10px] font-bold leading-none">{item.count}</span>
            </button>
          ))}

          {/* Quick add more reaction button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowPicker((prev) => !prev);
            }}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-card-bg)] border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
            title="Add reaction"
            aria-label="Add another reaction"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-modal-title-${targetMsgId}`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => !isDeleting && setShowDeleteConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] p-5 shadow-2xl text-[var(--color-main-text)] animate-scale-in"
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id={`delete-modal-title-${targetMsgId}`}
                  className="text-sm font-bold text-[var(--color-main-text)]"
                >
                  Delete message?
                </h3>
                <p className="text-xs text-[var(--color-secondary-text)] mt-1 leading-relaxed">
                  Are you sure you want to delete this message? This message will be permanently removed for everyone in this conversation.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-borders)]/50">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Enlarged Image Viewer */}
      {showLightbox && attachment && attachment.url && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowLightbox(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center animate-scale-in"
          >
            <div className="absolute -top-11 right-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownload('download')}
                disabled={isDownloading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer select-none"
                title="Download original image"
                aria-label="Download image"
              >
                {isDownloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLightbox(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer select-none"
                title="Close image viewer"
                aria-label="Close image viewer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={attachment.url}
              alt={attachment.originalName || 'Enlarged image'}
              className="max-w-full max-h-[82vh] rounded-2xl object-contain shadow-2xl"
            />
            {attachment.originalName && (
              <p className="mt-2.5 text-xs text-white/80 font-medium select-none truncate max-w-md">
                {attachment.originalName}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
