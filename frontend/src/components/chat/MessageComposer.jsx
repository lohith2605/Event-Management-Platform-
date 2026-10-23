import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Paperclip, X, AlertCircle, FileText, FileSpreadsheet, Reply } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024; // 15MB

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const ALLOWED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'pdf',
  'txt',
  'csv',
  'docx',
  'xlsx',
];

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const isImageFile = (file) => {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  const ext = (file.name || '').split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
};

const getDocIconAndColor = (filename = '', mimeType = '') => {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return { Icon: FileText, label: 'PDF', bg: 'bg-red-500/10 text-red-500 border-red-500/20' };
  }
  if (
    ext === 'xlsx' ||
    ext === 'csv' ||
    mimeType.includes('csv') ||
    mimeType.includes('spreadsheet')
  ) {
    return {
      Icon: FileSpreadsheet,
      label: ext.toUpperCase() || 'XLS',
      bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    };
  }
  if (ext === 'docx' || mimeType.includes('word')) {
    return { Icon: FileText, label: 'DOC', bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
  }
  return { Icon: FileText, label: 'TXT', bg: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
};

export default function MessageComposer({
  onSendMessage,
  onTyping,
  disabled = false,
  sending = false,
  replyingTo: propReplyingTo,
  onCancelReply,
}) {
  const { replyingTo: contextReplyingTo, setReplyingTo } = useChat();
  const activeReplyingTo = propReplyingTo !== undefined ? propReplyingTo : contextReplyingTo;

  const handleCancelReply = () => {
    if (onCancelReply) {
      onCancelReply();
    } else if (setReplyingTo) {
      setReplyingTo(null);
    }
  };

  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const previewUrlRef = useRef(null);

  // Keep previewUrlRef in sync for cleanup
  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  // Clean up object URLs on unmount or file change
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  // Auto-resize textarea height as text grows up to 140px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        140,
        Math.max(40, textareaRef.current.scrollHeight)
      )}px`;
    }
  }, [text]);

  const handleChange = (e) => {
    const val = e.target.value;
    if (val.length <= 2000) {
      setText(val);
      if (uploadError) setUploadError('');
      if (onTyping) {
        onTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          onTyping(false);
        }, 2000);
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');

    const mime = (file.type || '').toLowerCase();
    const ext = (file.name || '').split('.').pop().toLowerCase();
    const isMimeAllowed = ALLOWED_MIME_TYPES.includes(mime);
    const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext);

    if (!isMimeAllowed && !isExtAllowed) {
      setUploadError(
        'Unsupported file format. Supported formats: JPEG, PNG, WebP, GIF, PDF, TXT, CSV, DOCX, XLSX.'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const isImg = isImageFile(file);
    if (isImg && file.size > MAX_IMAGE_SIZE) {
      setUploadError('Image exceeds the maximum allowed size of 10MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (!isImg && file.size > MAX_DOCUMENT_SIZE) {
      setUploadError('Document exceeds the maximum allowed size of 15MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Clean up previous preview URL if any
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);

    if (isImg) {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    } else {
      setPreviewUrl(null);
    }

    // Reset file input value so selecting the same file again triggers change event
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isSending = Boolean(sending || isSubmitting);
  const canSend = Boolean((text.trim() || selectedFile) && !isSending && !disabled);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!canSend || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setUploadError('');

    if (onTyping) {
      onTyping(false);
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    try {
      const payload = {
        text: trimmed,
        ...(selectedFile ? { file: selectedFile } : {}),
        ...(activeReplyingTo?._id ? { replyToMessageId: activeReplyingTo._id } : {}),
      };

      const res = await onSendMessage(payload);
      if (res && res.success) {
        // Success: clear text, attachment preview, and reply state
        setText('');
        handleRemoveFile();
        handleCancelReply();
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } else if (res && res.error) {
        setUploadError(res.error);
      }
    } catch (err) {
      setUploadError(err.message || 'Failed to send message.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const charCount = text.length;
  const isOverLimit = charCount > 2000;
  const isNearLimit = charCount >= 1800;

  return (
    <div className="p-3 sm:p-4 border-t border-[var(--color-borders)] bg-[var(--color-card-bg)] shrink-0">
      {/* Upload Error Banner */}
      {uploadError && (
        <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadError('')}
            className="text-red-500 hover:opacity-75 cursor-pointer shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quoted Message Reply Preview Banner */}
      {activeReplyingTo && (
        <div className="mb-2.5 p-2 sm:px-3 sm:py-2 rounded-2xl bg-[var(--color-primary-action)]/10 border-l-4 border-l-[var(--color-primary-action)] border border-[var(--color-borders)] flex items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)] flex items-center justify-center shrink-0">
              <Reply className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-[var(--color-primary-action)] truncate">
                  Replying to {activeReplyingTo.senderName || 'Participant'}
                </span>
                {activeReplyingTo.senderRole && (
                  <span className="text-[9px] uppercase tracking-wider text-[var(--color-secondary-text)] font-semibold">
                    ({activeReplyingTo.senderRole})
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--color-main-text)]/90 truncate max-w-[200px] sm:max-w-md mt-0.5">
                {activeReplyingTo.isDeleted
                  ? 'This message was deleted'
                  : activeReplyingTo.text
                  ? activeReplyingTo.text
                  : (activeReplyingTo.attachment?.originalName || activeReplyingTo.attachments?.[0]?.originalName)
                  ? `📄 ${activeReplyingTo.attachment?.originalName || activeReplyingTo.attachments?.[0]?.originalName}`
                  : (activeReplyingTo.attachment?.url || activeReplyingTo.attachments?.[0]?.url)
                  ? '📷 Image'
                  : 'Attachment'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelReply}
            disabled={isSending}
            className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--color-secondary-text)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
            title="Cancel reply (keeps typed message)"
            aria-label="Cancel reply"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected File Local Preview Bar (Image or Document) */}
      {selectedFile && (
        <div className="mb-2.5 p-2 rounded-2xl bg-[var(--color-secondary-bg)]/80 border border-[var(--color-borders)] flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3 min-w-0">
            {previewUrl ? (
              <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-[var(--color-borders)] bg-black/10 shrink-0">
                <img
                  src={previewUrl}
                  alt="Selected image preview"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              (() => {
                const { Icon, label, bg } = getDocIconAndColor(
                  selectedFile.name,
                  selectedFile.type
                );
                return (
                  <div
                    className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center shrink-0 ${bg}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[9px] font-bold tracking-wider uppercase mt-0.5">
                      {label}
                    </span>
                  </div>
                );
              })()
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--color-main-text)] truncate max-w-[200px] sm:max-w-xs">
                {selectedFile.name}
              </p>
              <p className="text-[10px] text-[var(--color-secondary-text)] mt-0.5">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemoveFile}
            disabled={isSending}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--color-secondary-text)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
            title="Remove attachment"
            aria-label="Remove attached file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2">
        {/* Hidden File Picker Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.pdf,.txt,.csv,.docx,.xlsx"
          onChange={handleFileSelect}
          disabled={disabled || isSending}
          className="hidden"
          aria-label="Upload file attachment"
        />

        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isSending}
          className={`min-w-[40px] min-h-[40px] p-2 sm:p-2.5 rounded-2xl border border-[var(--color-borders)] transition-all cursor-pointer shrink-0 flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] ${
            selectedFile
              ? 'bg-[var(--color-primary-action)]/15 border-[var(--color-primary-action)] text-[var(--color-primary-action)]'
              : 'bg-[var(--color-primary-bg)]/80 text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          title="Attach an image or document (PDF, TXT, CSV, DOCX, XLSX up to 15MB)"
          aria-label="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Text Area Input */}
        <div className="flex-1 min-w-0 relative rounded-2xl border border-[var(--color-borders)] bg-[var(--color-primary-bg)]/80 focus-within:border-[var(--color-primary-action)] focus-within:ring-2 focus-within:ring-[var(--color-primary-action)]/20 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => onTyping && onTyping(false)}
            placeholder={
              isSending
                ? 'Sending message...'
                : selectedFile
                ? 'Add an optional caption... (Enter to send)'
                : 'Type a message... (Enter to send, Shift+Enter for new line)'
            }
            aria-label="Type a message"
            disabled={disabled || isSending}
            maxLength={2000}
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-transparent text-[var(--color-main-text)] placeholder-[var(--color-secondary-text)] resize-none focus:outline-hidden leading-relaxed min-h-[40px] max-h-[140px]"
          />

          {/* Character Counter */}
          {charCount > 0 && (
            <div
              className={`absolute right-2.5 bottom-1 text-[9px] font-mono font-bold select-none ${
                isOverLimit
                  ? 'text-red-500'
                  : isNearLimit
                  ? 'text-amber-500'
                  : 'text-[var(--color-secondary-text)]'
              }`}
            >
              {charCount} / 2000
            </div>
          )}
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend || isOverLimit}
          className="min-w-[44px] min-h-[44px] p-2.5 sm:p-3 rounded-2xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-white font-bold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] focus-visible:ring-offset-2"
          title={isSending ? 'Sending...' : 'Send message'}
          aria-label={isSending ? 'Sending message...' : 'Send message'}
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

