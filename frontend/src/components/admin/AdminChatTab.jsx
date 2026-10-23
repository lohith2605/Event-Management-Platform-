import { useState } from 'react';
import { MessageSquare, ShieldCheck, RefreshCw } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import ConversationList from '../chat/ConversationList';
import ConversationHeader from '../chat/ConversationHeader';
import MessageTimeline from '../chat/MessageTimeline';
import MessageComposer from '../chat/MessageComposer';
import MessageSearchPanel from '../chat/MessageSearchPanel';
import SharedContentPanel from '../chat/SharedContentPanel';

export default function AdminChatTab() {
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
    sendingMessage,
    sendTyping,
    typingUsers,
    chatError,
    isConnected,
    refreshConversations,
    otherParticipantId,
    isSharedOpen,
    setIsSharedOpen,
    sharedInitialTab,
  } = useChat();

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Admin view strictly displays admin_organizer conversations
  const adminConversations = conversations.filter((c) => c.type === 'admin_organizer');

  return (
    <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-none sm:rounded-2xl md:rounded-3xl shadow-xs overflow-hidden h-[750px] max-h-[82vh] flex flex-col">
      {/* Top Header */}
      <div className="p-4 border-b border-[var(--color-borders)] flex items-center justify-between gap-3 bg-[var(--color-primary-bg)]/30">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-[var(--color-main-text)] font-serif">
              Organizer Direct Support
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
              <ShieldCheck className="w-3 h-3" />
              Admin Access Only
            </span>
          </div>
          <p className="text-xs text-[var(--color-secondary-text)]">
            Communicate directly with event organizers regarding approved & published event operations.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshConversations}
          aria-label="Refresh conversations"
          className="p-1.5 rounded-xl border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
          title="Refresh conversations"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Split Pane */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Pane: Conversation List */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-[var(--color-borders)] flex flex-col shrink-0 ${
            activeConversation ? 'hidden md:flex' : 'flex'
          }`}
        >
          <ConversationList
            conversations={adminConversations}
            activeConversationId={activeConversation?._id}
            onSelectConversation={(conv) => openConversation(conv, { autoOpenDrawer: false })}
            loading={loadingConversations}
          />
        </div>

        {/* Right Pane: Active Chat */}
        <div
          className={`flex-1 flex flex-col bg-[var(--color-primary-bg)]/20 ${
            !activeConversation ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConversation ? (
            <>
              <ConversationHeader
                conversation={activeConversation}
                showBackButton={true}
                onBack={() => {
                  setIsSearchOpen(false);
                  leaveConversation();
                }}
                onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
                isSearchOpen={isSearchOpen}
                isConnected={isConnected}
              />

              <MessageSearchPanel
                conversationId={activeConversation?._id}
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
              />

              <SharedContentPanel
                conversationId={activeConversation?._id}
                isOpen={isSharedOpen}
                onClose={() => setIsSharedOpen(false)}
                initialTab={sharedInitialTab}
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
                disabled={loadingMessages}
                sending={sendingMessage}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--color-secondary-text)] space-y-2 my-auto">
              <div className="w-16 h-16 rounded-3xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] flex items-center justify-center text-[var(--color-primary-action)] shadow-xs mb-1">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="font-extrabold text-base text-[var(--color-main-text)] font-serif">
                Select an organizer conversation
              </h3>
              <p className="text-xs max-w-sm">
                Select an event from the list on the left or click &quot;Organizer Chat&quot; on any published event in the Event Moderation table.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
