/**
 * UTSAV — Real-Time Event Chat API Client
 * Secure REST API endpoints for attendee, organizer, and admin private event conversations.
 * All requests include HTTP-only session cookies and enforce server-side authorization.
 */

const handleResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'An unexpected server error occurred.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
};

/**
 * Fetch all conversations accessible to the authenticated user
 * (Attendees see their event chats; Organizers see their event chats; Admins see admin-organizer chats)
 */
export const fetchConversationsApi = async () => {
  const response = await fetch('/api/chat/conversations', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Fetch a single conversation by ID with server-side access verification
 */
export const fetchConversationByIdApi = async (id) => {
  const response = await fetch(`/api/chat/conversations/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Create or retrieve an existing conversation atomically
 * @param {Object} params
 * @param {string} params.eventId
 * @param {'admin_organizer'|'attendee_organizer'} params.type
 * @param {string} [params.attendeeId] - Optional, required only if organizer initiates chat with attendee
 */
export const createOrGetConversationApi = async ({ eventId, type, attendeeId }) => {
  const response = await fetch('/api/chat/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ eventId, type, attendeeId }),
  });
  return handleResponse(response);
};

/**
 * Fetch message history for a conversation with pagination
 * @param {string} conversationId
 * @param {Object} [params]
 * @param {number} [params.limit=50]
 * @param {string|Date} [params.before] - Cursor date for older messages
 */
export const fetchMessagesApi = async (conversationId, { limit = 50, before } = {}) => {
  let url = `/api/chat/conversations/${conversationId}/messages?limit=${encodeURIComponent(limit)}`;
  if (before) {
    const beforeIso = before instanceof Date ? before.toISOString() : before;
    url += `&before=${encodeURIComponent(beforeIso)}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Send a message via REST within an authorized conversation
 * @param {string} conversationId
 * @param {string} text - Message text (1-2000 characters)
 */
export const sendMessageApi = async (conversationId, text) => {
  const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text }),
  });
  return handleResponse(response);
};

/**
 * Mark all messages in a conversation as read by the authenticated user
 * @param {string} conversationId
 */
export const markConversationReadApi = async (conversationId) => {
  const response = await fetch(`/api/chat/conversations/${conversationId}/read`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Get total unread messages count across all accessible conversations
 */
export const fetchUnreadChatCountApi = async () => {
  const response = await fetch('/api/chat/unread-count', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};
