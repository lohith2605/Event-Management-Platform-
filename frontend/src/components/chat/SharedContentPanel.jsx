import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Image as ImageIcon,
  FileText,
  Link2,
  ExternalLink,
  Download,
  CornerDownRight,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  FileCode,
  File,
  RotateCcw,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { fetchSharedContentApi } from '../../api/chat';
import { extractId } from '../../utils/chatUtils';

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const getDocumentIcon = (originalName = '', mimeType = '') => {
  const ext = originalName.split('.').pop().toLowerCase();
  const mime = mimeType.toLowerCase();

  if (ext === 'pdf' || mime === 'application/pdf') {
    return {
      Icon: FileText,
      label: 'PDF',
      isPdf: true,
      colorClass: 'text-red-500 bg-red-500/10 border-red-500/20',
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
      colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    };
  }
  if (ext === 'docx' || mime.includes('word')) {
    return {
      Icon: FileText,
      label: 'DOC',
      isPdf: false,
      colorClass: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    };
  }
  if (['js', 'json', 'html', 'css', 'ts'].includes(ext)) {
    return {
      Icon: FileCode,
      label: ext.toUpperCase(),
      isPdf: false,
      colorClass: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    };
  }
  return {
    Icon: File,
    label: ext.toUpperCase() || 'FILE',
    isPdf: false,
    colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  };
};

export default function SharedContentPanel({
  conversationId,
  isOpen,
  onClose,
  initialTab = 'media',
}) {
  const { jumpToMessage, downloadAttachment, activeConversation, isConnected } = useChat();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [lightboxItem, setLightboxItem] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [jumpError, setJumpError] = useState('');

  const currentConvId = extractId(conversationId || activeConversation?._id);
  const activeRequestIdRef = useRef(0);
  const panelRef = useRef(null);

  // Sync initial tab when panel opens
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Load content whenever tab or conversation changes
  const loadContent = useCallback(
    async (tab, targetPage = 1, isAppending = false) => {
      if (!currentConvId || !isOpen) return;

      const requestId = ++activeRequestIdRef.current;
      if (isAppending) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError('');
      }

      try {
        const res = await fetchSharedContentApi(currentConvId, {
          type: tab,
          page: targetPage,
          limit: 30,
        });

        // Drop response if a newer request has started
        if (requestId !== activeRequestIdRef.current) return;

        if (res && res.success) {
          const newItems = Array.isArray(res.items) ? res.items : [];
          setItems((prev) => (isAppending ? [...prev, ...newItems] : newItems));
          setPage(res.pagination?.page || targetPage);
          setHasMore(Boolean(res.pagination?.hasMore));
          setTotalCount(res.pagination?.totalCount || 0);
          setError('');
        } else {
          throw new Error(res?.message || 'Failed to load shared content.');
        }
      } catch (err) {
        if (requestId === activeRequestIdRef.current) {
          console.warn('Error loading shared content:', err);
          setError(err.message || 'Failed to load shared content.');
        }
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [currentConvId, isOpen]
  );

  useEffect(() => {
    if (isOpen && currentConvId) {
      loadContent(activeTab, 1, false);
    } else {
      setItems([]);
      setPage(1);
      setHasMore(false);
      setLightboxItem(null);
    }
  }, [isOpen, activeTab, currentConvId, loadContent]);

  // Escape key handler to close panel or lightbox
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (lightboxItem) {
          setLightboxItem(null);
        } else if (onClose) {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, lightboxItem, onClose]);

  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    setActiveTab(newTab);
    setPage(1);
    setItems([]);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    loadContent(activeTab, page + 1, true);
  };

  const handleJump = async (item) => {
    if (!item || !item.messageId || !jumpToMessage) return;
    try {
      setJumpError('');
      const res = await jumpToMessage(item.messageId, item.createdAt);
      if (res && res.notFound) {
        setJumpError('Message is no longer available in history.');
        setTimeout(() => setJumpError(''), 4000);
      } else if (onClose) {
        // Close the panel so user can see the highlighted message in timeline
        onClose();
      }
    } catch (err) {
      setJumpError(err.message || 'Failed to navigate to message.');
      setTimeout(() => setJumpError(''), 4000);
    }
  };

  const handleDownload = async (item, action = 'download') => {
    if (!item || !item.attachment || !downloadAttachment) return;
    const msgId = extractId(item.messageId);
    const filename = item.attachment.originalName || 'download';

    try {
      setDownloadingId(item._id);
      await downloadAttachment(currentConvId, msgId, filename, action);
    } catch (err) {
      console.warn('Failed to download shared attachment:', err);
      setError(err.message || 'Failed to download attachment.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setDownloadingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label="Shared media, documents and links"
      className="border-b border-[var(--color-borders)] bg-[var(--color-card-bg)] shadow-md animate-fade-in flex flex-col max-h-[460px] sm:max-h-[520px] transition-all z-20 shrink-0"
    >
      {/* Header with Title and Tabs */}
      <div className="p-3 sm:p-4 border-b border-[var(--color-borders)]/70 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-sm text-[var(--color-main-text)]">
              Shared Content
            </h3>
            {totalCount > 0 && !loading && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)] border border-[var(--color-primary-action)]/20">
                {totalCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
            title="Close shared content"
            aria-label="Close shared content panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          role="tablist"
          aria-label="Shared content categories"
          className="flex items-center gap-1.5 p-1 bg-[var(--color-secondary-bg)]/80 rounded-xl border border-[var(--color-borders)]/50 text-xs font-semibold"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'media'}
            onClick={() => handleTabChange('media')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg transition-all cursor-pointer select-none ${
              activeTab === 'media'
                ? 'bg-[var(--color-card-bg)] text-[var(--color-primary-action)] shadow-xs font-bold'
                : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Media</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'documents'}
            onClick={() => handleTabChange('documents')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg transition-all cursor-pointer select-none ${
              activeTab === 'documents'
                ? 'bg-[var(--color-card-bg)] text-[var(--color-primary-action)] shadow-xs font-bold'
                : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Documents</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'links'}
            onClick={() => handleTabChange('links')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg transition-all cursor-pointer select-none ${
              activeTab === 'links'
                ? 'bg-[var(--color-card-bg)] text-[var(--color-primary-action)] shadow-xs font-bold'
                : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Links</span>
          </button>
        </div>
      </div>

      {/* Notification / Jump Error */}
      {jumpError && (
        <div className="mx-3.5 mt-2 px-3 py-1.5 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 animate-fade-in shrink-0">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{jumpError}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 min-h-[180px]">
        {/* Loading State */}
        {loading && (
          <div className="h-44 flex flex-col items-center justify-center gap-2 text-[var(--color-secondary-text)]">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary-action)]" />
            <p className="text-xs">Loading shared {activeTab}...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="h-44 flex flex-col items-center justify-center gap-2.5 text-center p-4">
            <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-xs text-[var(--color-secondary-text)] max-w-xs">{error}</p>
            <button
              type="button"
              onClick={() => loadContent(activeTab, 1, false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] text-[var(--color-main-text)] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && items.length === 0 && (
          <div className="h-44 flex flex-col items-center justify-center gap-2 text-center p-4 select-none">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-secondary-bg)] text-[var(--color-secondary-text)] flex items-center justify-center mb-1">
              {activeTab === 'media' && <ImageIcon className="w-6 h-6 opacity-60" />}
              {activeTab === 'documents' && <FileText className="w-6 h-6 opacity-60" />}
              {activeTab === 'links' && <Link2 className="w-6 h-6 opacity-60" />}
            </div>
            <p className="text-xs font-bold text-[var(--color-main-text)]">
              No {activeTab} shared yet
            </p>
            <p className="text-[11px] text-[var(--color-secondary-text)] max-w-xs leading-relaxed">
              {activeTab === 'media' && 'Photos and images sent in this conversation will appear here.'}
              {activeTab === 'documents' && 'PDFs, spreadsheets, and files sent in this chat will appear here.'}
              {activeTab === 'links' && 'Web links and URLs included in conversation messages will appear here.'}
            </p>
          </div>
        )}

        {/* --- Tab A: Media Grid --- */}
        {!loading && !error && activeTab === 'media' && items.length > 0 && (
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
            {items.map((item) => (
              <div
                key={item._id}
                className="group relative aspect-square rounded-xl overflow-hidden bg-black/10 dark:bg-black/30 border border-[var(--color-borders)]/60 cursor-pointer shadow-xs transition-transform hover:scale-[1.02]"
                onClick={() => setLightboxItem(item)}
              >
                <img
                  src={item.attachment?.url}
                  alt={item.attachment?.originalName || 'Shared image'}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />

                {/* Hover overlay with quick actions */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity p-2 flex flex-col justify-between text-white">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(item, 'download');
                      }}
                      disabled={downloadingId === item._id}
                      className="p-1 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors cursor-pointer"
                      title="Download image"
                      aria-label="Download image"
                    >
                      {downloadingId === item._id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJump(item);
                      }}
                      className="p-1 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors cursor-pointer"
                      title="Jump to message"
                      aria-label="Jump to source message"
                    >
                      <CornerDownRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold truncate">
                      {item.senderName || 'Participant'}
                    </p>
                    <p className="text-[9px] text-white/75 truncate">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- Tab B: Documents List --- */}
        {!loading && !error && activeTab === 'documents' && items.length > 0 && (
          <div className="flex flex-col gap-2">
            {items.map((item) => {
              const att = item.attachment;
              const { Icon, label, isPdf, colorClass } = getDocumentIcon(
                att?.originalName,
                att?.mimeType
              );

              return (
                <div
                  key={item._id}
                  className="p-2.5 rounded-xl bg-[var(--color-secondary-bg)]/40 hover:bg-[var(--color-secondary-bg)]/80 border border-[var(--color-borders)]/60 flex items-center justify-between gap-3 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center shrink-0 border ${colorClass}`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[7px] font-bold uppercase tracking-wider mt-0.5">
                        {label}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className="text-xs font-bold text-[var(--color-main-text)] truncate"
                        title={att?.originalName}
                      >
                        {att?.originalName || 'Document'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--color-secondary-text)]">
                        <span>{formatFileSize(att?.size)}</span>
                        <span>&bull;</span>
                        <span className="truncate max-w-[100px] sm:max-w-[140px]">
                          {item.senderName || 'Participant'}
                        </span>
                        <span>&bull;</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Document Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isPdf && (
                      <button
                        type="button"
                        onClick={() => handleDownload(item, 'open')}
                        className="p-1.5 rounded-lg border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-card-bg)] transition-colors cursor-pointer"
                        title="Open PDF in new tab"
                        aria-label="Open PDF document"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDownload(item, 'download')}
                      disabled={downloadingId === item._id}
                      className="p-1.5 rounded-lg border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-card-bg)] transition-colors cursor-pointer disabled:opacity-50"
                      title="Download document"
                      aria-label="Download document"
                    >
                      {downloadingId === item._id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleJump(item)}
                      className="p-1.5 rounded-lg border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-primary-action)] hover:bg-[var(--color-card-bg)] transition-colors cursor-pointer"
                      title="Jump to message"
                      aria-label="Jump to source message"
                    >
                      <CornerDownRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- Tab C: Links List --- */}
        {!loading && !error && activeTab === 'links' && items.length > 0 && (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <div
                key={item._id}
                className="p-2.5 rounded-xl bg-[var(--color-secondary-bg)]/40 hover:bg-[var(--color-secondary-bg)]/80 border border-[var(--color-borders)]/60 flex items-start justify-between gap-3 transition-colors group"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-action)]/10 border border-[var(--color-primary-action)]/20 text-[var(--color-primary-action)] flex items-center justify-center shrink-0 mt-0.5">
                    <Link2 className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-[var(--color-primary-action)] hover:underline truncate block"
                      title={item.url}
                    >
                      {item.domain || item.url}
                    </a>
                    {item.textSnippet && (
                      <p className="text-xs text-[var(--color-main-text)]/90 line-clamp-2 mt-0.5 break-words">
                        {item.textSnippet}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--color-secondary-text)]">
                      <span className="truncate max-w-[120px]">
                        {item.senderName || 'Participant'}
                      </span>
                      <span>&bull;</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Link Actions */}
                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-card-bg)] transition-colors cursor-pointer inline-flex items-center justify-center"
                    title="Open link in new tab"
                    aria-label="Open external link"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleJump(item)}
                    className="p-1.5 rounded-lg border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-primary-action)] hover:bg-[var(--color-card-bg)] transition-colors cursor-pointer"
                    title="Jump to message"
                    aria-label="Jump to source message"
                  >
                    <CornerDownRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Pagination */}
        {!loading && hasMore && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] text-[var(--color-main-text)] transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading more...</span>
                </>
              ) : (
                <span>Load older {activeTab}</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Lightbox / Enlarged Media Viewer */}
      {lightboxItem && lightboxItem.attachment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged media viewer"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
          onClick={() => setLightboxItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center animate-scale-in"
          >
            <div className="absolute -top-11 right-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleJump(lightboxItem)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer select-none"
                title="Jump to original message"
                aria-label="Jump to source message"
              >
                <CornerDownRight className="w-3.5 h-3.5" />
                <span>Jump</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownload(lightboxItem, 'download')}
                disabled={downloadingId === lightboxItem._id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer select-none"
                title="Download original image"
                aria-label="Download image"
              >
                {downloadingId === lightboxItem._id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download</span>
              </button>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer select-none"
                title="Close viewer"
                aria-label="Close image viewer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <img
              src={lightboxItem.attachment?.url}
              alt={lightboxItem.attachment?.originalName || 'Enlarged image'}
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl"
            />

            <div className="mt-2.5 flex items-center gap-3 text-xs text-white/80 font-medium select-none truncate max-w-md">
              <span className="truncate">
                {lightboxItem.attachment?.originalName || 'Image'}
              </span>
              <span>&bull;</span>
              <span>{lightboxItem.senderName || 'Participant'}</span>
              <span>&bull;</span>
              <span>{formatDate(lightboxItem.createdAt)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
