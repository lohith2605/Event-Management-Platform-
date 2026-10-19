import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import ConversationHeader from './ConversationHeader';
import MessageTimeline from './MessageTimeline';
import MessageComposer from './MessageComposer';
import ConversationList from './ConversationList';

export default function ChatDrawer() {
  const {
    isChatDrawerOpen,
    setIsChatDrawerOpen,
    activeConversation,
    openConversation,
    leaveConversation,
    conversations,
    loadingConversations,
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
  } = useChat();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isChatDrawerOpen) {
        setIsChatDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatDrawerOpen, setIsChatDrawerOpen]);

  // Lock background scroll when open
  useEffect(() => {
    if (isChatDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isChatDrawerOpen]);

  if (!isChatDrawerOpen) return null;

  // Determine other participant ID for read receipts
  let otherParticipantId = null;
  if (activeConversation) {
    if (activeConversation.type === 'admin_organizer') {
      otherParticipantId = activeConversation.organizerId?._id || activeConversation.organizerId;
    } else {
      otherParticipantId = activeConversation.attendeeId?._id || activeConversation.attendeeId;
    }
  }

  const drawerContent = (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={() => setIsChatDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="relative z-10 w-full sm:max-w-md md:max-w-lg h-full bg-[var(--color-card-bg)] border-l border-[var(--color-borders)] shadow-2xl flex flex-col text-[var(--color-main-text)]">
        {activeConversation ? (
          /* Active Conversation Thread View */
          <>
            <ConversationHeader
              conversation={activeConversation}
              showBackButton={true}
              onBack={leaveConversation}
              onClose={() => setIsChatDrawerOpen(false)}
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
              onRetry={() => openConversation(activeConversation._id)}
              otherParticipantId={otherParticipantId}
            />

            <MessageComposer
              onSendMessage={sendMessage}
              onTyping={sendTyping}
              disabled={loadingMessages || !activeConversation}
            />
          </>
        ) : (
          /* Inbox / Conversation List View */
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-[var(--color-borders)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)] flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm font-serif">Event Messages</h3>
                  <span className="text-[11px] text-[var(--color-secondary-text)]">
                    Secure real-time event conversations
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsChatDrawerOpen(false)}
                className="p-1.5 rounded-xl text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
                title="Close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0">
              <ConversationList
                conversations={conversations}
                activeConversationId={null}
                onSelectConversation={(conv) => openConversation(conv, { autoOpenDrawer: true })}
                loading={loadingConversations}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}
