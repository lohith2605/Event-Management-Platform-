import { useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, RefreshCw, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import ConversationList from '../components/chat/ConversationList';
import ConversationHeader from '../components/chat/ConversationHeader';
import MessageTimeline from '../components/chat/MessageTimeline';
import MessageComposer from '../components/chat/MessageComposer';

export default function MessagesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const convIdFromUrl = searchParams.get('c');
  const handledConvIdRef = useRef(null);

  const {
    conversations,
    loadingConversations,
    activeConversation,
    openConversation,
    leaveConversation,
    messages,
    loadingMessages,
    loadingMoreMessages,
    hasMoreMessages,
    loadOlderMessages,
    sendMessage,
    sendTyping,
    typingUsers,
    chatError,
    isConnected,
    refreshConversations,
    setIsChatDrawerOpen,
    sendingMessage,
  } = useChat();

  // Close the quick-access slide-over drawer when entering the dedicated Messages page
  useEffect(() => {
    setIsChatDrawerOpen(false);
  }, [setIsChatDrawerOpen]);

  const prevConvIdFromUrlRef = useRef(convIdFromUrl);

  // Synchronize deep link URL (?c=<id>) with active conversation state
  useEffect(() => {
    // 1. Browser Back/Forward navigation: If URL lost the ?c= parameter, return to inbox
    if (!convIdFromUrl) {
      handledConvIdRef.current = null;
      if (prevConvIdFromUrlRef.current) {
        // User navigated back from a deep-linked conversation to the base /messages inbox
        prevConvIdFromUrlRef.current = null;
        if (activeConversation) {
          leaveConversation();
        }
        return;
      }
      // If a conversation was opened externally (e.g. via notification click or drawer expand) while on /messages, sync URL
      if (activeConversation?._id) {
        const activeId = activeConversation._id.toString();
        handledConvIdRef.current = activeId;
        prevConvIdFromUrlRef.current = activeId;
        setSearchParams({ c: activeId }, { replace: true });
        return;
      }
      prevConvIdFromUrlRef.current = null;
      return;
    }

    prevConvIdFromUrlRef.current = convIdFromUrl;

    // 2. Skip if this exact conversation is already active
    if (activeConversation?._id?.toString() === convIdFromUrl) {
      handledConvIdRef.current = convIdFromUrl;
      return;
    }

    // 3. Skip if this attempt is already in-flight for this ID
    if (handledConvIdRef.current === convIdFromUrl) {
      return;
    }

    handledConvIdRef.current = convIdFromUrl;
    openConversation(convIdFromUrl, { autoOpenDrawer: false });
  }, [convIdFromUrl, activeConversation, openConversation, leaveConversation, setSearchParams]);

  // Handle selecting conversation from the inbox list
  const handleSelectConversation = useCallback(
    (conv) => {
      if (!conv?._id) return;
      const convId = conv._id.toString();
      handledConvIdRef.current = convId;
      prevConvIdFromUrlRef.current = convId;
      setSearchParams({ c: convId }, { replace: true });
      openConversation(conv, { autoOpenDrawer: false });
    },
    [openConversation, setSearchParams]
  );

  // Handle back to inbox button (mobile view & resets URL query)
  const handleBackToInbox = useCallback(() => {
    handledConvIdRef.current = null;
    prevConvIdFromUrlRef.current = null;
    setSearchParams({}, { replace: true });
    leaveConversation();
  }, [leaveConversation, setSearchParams]);

  // Safe retry handler: prevents access to undefined _id and resets in-flight ref
  const handleRetry = useCallback(() => {
    handledConvIdRef.current = null;
    const targetId = activeConversation?._id || convIdFromUrl;
    if (targetId) {
      openConversation(targetId, { autoOpenDrawer: false });
    }
  }, [activeConversation?._id, convIdFromUrl, openConversation]);

  // Determine other participant ID for read receipts
  let otherParticipantId = null;
  if (activeConversation) {
    if (activeConversation.type === 'admin_organizer') {
      otherParticipantId = activeConversation.organizerId?._id || activeConversation.organizerId;
    } else {
      otherParticipantId = activeConversation.attendeeId?._id || activeConversation.attendeeId;
    }
  }

  // On mobile or desktop: indicate deep-link opening state or error
  const hasDeepLinkError = Boolean(!activeConversation && convIdFromUrl && chatError);
  const isOpeningDeepLink = Boolean(convIdFromUrl && !activeConversation && !chatError);
  const showCenterPanel = Boolean(activeConversation || hasDeepLinkError || isOpeningDeepLink);

  return (
    <div className="h-[calc(100vh-5rem)] max-h-[calc(100vh-5rem)] sm:h-[calc(100vh-5rem)] flex flex-col p-0 sm:p-3 md:p-5 lg:p-6 max-w-7xl mx-auto w-full bg-[var(--color-primary-bg)]">
      {/* Main Split-Pane Card Container */}
      <div className="flex-1 min-h-0 bg-[var(--color-card-bg)] border-0 sm:border border-[var(--color-borders)] rounded-none sm:rounded-2xl md:rounded-3xl shadow-xs overflow-hidden flex flex-col">
        {/* Top Header Bar (Desktop & Mobile Inbox View) */}
        <div
          className={`px-4 py-3 border-b border-[var(--color-borders)] items-center justify-between gap-3 bg-[var(--color-primary-bg)]/40 shrink-0 ${
            showCenterPanel ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-action)]/15 border border-[var(--color-primary-action)]/20 text-[var(--color-primary-action)] flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold text-[var(--color-main-text)] font-serif leading-tight truncate">
                Event Messages
              </h1>
              <p className="text-[11px] text-[var(--color-secondary-text)] leading-none truncate hidden sm:block">
                Real-time conversations with organizers, attendees & platform admins
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={refreshConversations}
              className="p-2 rounded-xl border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] transition-colors cursor-pointer"
              title="Refresh conversations"
              aria-label="Refresh conversations"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Split Pane: Left Inbox / Center Active Chat */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left Panel: Conversation List */}
          <div
            className={`w-full md:w-80 lg:w-96 border-r-0 md:border-r border-[var(--color-borders)] flex flex-col shrink-0 min-h-0 ${
              showCenterPanel ? 'hidden md:flex' : 'flex'
            }`}
          >
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversation?._id}
              onSelectConversation={handleSelectConversation}
              loading={loadingConversations}
            />
          </div>

          {/* Center Panel: Active Conversation, Error State, or Placeholder */}
          <div
            className={`flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--color-primary-bg)]/20 ${
              !showCenterPanel ? 'hidden md:flex' : 'flex'
            }`}
          >
            {activeConversation ? (
              <>
                <ConversationHeader
                  conversation={activeConversation}
                  showBackButton={true}
                  onBack={handleBackToInbox}
                  isConnected={isConnected}
                />

                <MessageTimeline
                  messages={messages}
                  loading={loadingMessages}
                  loadingMore={loadingMoreMessages}
                  hasMore={hasMoreMessages}
                  onLoadMore={loadOlderMessages}
                  typingUsers={typingUsers}
                  error={chatError}
                  onRetry={handleRetry}
                  otherParticipantId={otherParticipantId}
                />

                <MessageComposer
                  onSendMessage={sendMessage}
                  onTyping={sendTyping}
                  disabled={loadingMessages || !activeConversation}
                  sending={sendingMessage}
                />
              </>
            ) : isOpeningDeepLink ? (
              /* Clean Opening State for Deep-Links */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--color-secondary-text)] space-y-3 my-auto">
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-action)]/10 text-[var(--color-primary-action)] flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-extrabold text-sm text-[var(--color-main-text)] font-serif">
                    Opening Conversation...
                  </h2>
                  <p className="text-xs text-[var(--color-secondary-text)]">
                    Connecting to secure event chat
                  </p>
                </div>
              </div>
            ) : hasDeepLinkError ? (
              /* Deep-Link Error View */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 my-auto">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shadow-xs">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h2 className="font-extrabold text-base sm:text-lg text-[var(--color-main-text)] font-serif">
                    Unable to Load Conversation
                  </h2>
                  <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                    The requested conversation could not be opened. You may not hold an eligible booking for this event, or the link may be invalid.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleBackToInbox}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-card-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] transition-colors cursor-pointer shadow-2xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Inbox</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary-action)] text-white hover:bg-[var(--color-primary-action-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] focus-visible:ring-offset-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Try Again</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Polished Empty State Placeholder */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--color-secondary-text)] space-y-3 my-auto">
                <div className="w-16 h-16 rounded-3xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] flex items-center justify-center text-[var(--color-primary-action)] shadow-xs">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h2 className="font-extrabold text-base sm:text-lg text-[var(--color-main-text)] font-serif">
                    Select a Conversation
                  </h2>
                  <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                    Choose a conversation on the left to read messages and reply in real time.
                  </p>
                </div>
                <div className="pt-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[var(--color-secondary-bg)]/80 text-[var(--color-secondary-text)] border border-[var(--color-borders)]">
                    Direct organizer & attendee support
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
