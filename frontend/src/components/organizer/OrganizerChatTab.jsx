import { useState } from 'react';
import { MessageSquare, ShieldCheck, Users, Search, RefreshCw, Calendar } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import ConversationList from '../chat/ConversationList';
import ConversationHeader from '../chat/ConversationHeader';
import MessageTimeline from '../chat/MessageTimeline';
import MessageComposer from '../chat/MessageComposer';

export default function OrganizerChatTab({ events = [] }) {
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
  } = useChat();

  const [selectedEventId, setSelectedEventId] = useState('all');

  // Filter conversations by selected event if chosen
  const displayedConversations = selectedEventId === 'all'
    ? conversations
    : conversations.filter((c) => (c.eventId?._id || c.eventId) === selectedEventId);

  // Other participant ID for read receipts
  let otherParticipantId = null;
  if (activeConversation) {
    if (activeConversation.type === 'admin_organizer') {
      otherParticipantId = activeConversation.organizerId?._id || activeConversation.organizerId;
    } else {
      otherParticipantId = activeConversation.attendeeId?._id || activeConversation.attendeeId;
    }
  }

  return (
    <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl shadow-xs overflow-hidden h-[750px] max-h-[82vh] flex flex-col">
      {/* Top Bar for Organizer Events Filter & Stats */}
      <div className="p-4 border-b border-[var(--color-borders)] flex flex-wrap items-center justify-between gap-3 bg-[var(--color-primary-bg)]/30">
        <div>
          <h2 className="text-base font-extrabold text-[var(--color-main-text)] font-serif">
            Event Messages & Inquiries
          </h2>
          <p className="text-xs text-[var(--color-secondary-text)]">
            Communicate privately with attendees and platform administrators for your events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {events.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-xl px-2.5 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-[var(--color-secondary-text)]" />
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="bg-transparent text-[var(--color-main-text)] text-xs font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Events ({events.length})</option>
                {events.map((evt) => (
                  <option key={evt._id} value={evt._id}>
                    {evt.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={refreshConversations}
            className="p-1.5 rounded-xl border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
            title="Refresh conversations"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Split Pane: Left Inbox / Right Active Chat */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Pane: Conversation List */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-[var(--color-borders)] flex flex-col shrink-0 ${
            activeConversation ? 'hidden md:flex' : 'flex'
          }`}
        >
          <ConversationList
            conversations={displayedConversations}
            activeConversationId={activeConversation?._id}
            onSelectConversation={(conv) => openConversation(conv, { autoOpenDrawer: false })}
            loading={loadingConversations}
          />
        </div>

        {/* Right Pane: Active Conversation or Placeholder */}
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
                onBack={leaveConversation}
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
                disabled={loadingMessages}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--color-secondary-text)] space-y-2">
              <div className="w-16 h-16 rounded-3xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] flex items-center justify-center text-[var(--color-primary-action)] shadow-xs mb-1">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="font-extrabold text-base text-[var(--color-main-text)] font-serif">
                Select a conversation
              </h3>
              <p className="text-xs max-w-sm">
                Choose an inquiry from the list on the left to read and reply in real time.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
