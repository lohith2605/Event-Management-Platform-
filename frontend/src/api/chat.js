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

export const fetchConversationsApi = async () => {
  const response = await fetch('/api/chat/conversations', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const fetchConversationByIdApi = async (id) => {
  const response = await fetch(`/api/chat/conversations/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const createOrGetConversationApi = async ({ eventId, type, attendeeId }) => {
  const response = await fetch('/api/chat/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ eventId, type, attendeeId }),
  });
  return handleResponse(response);
};

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

export const sendMessageApi = async (conversationId, text) => {
  const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text }),
  });
  return handleResponse(response);
};

export const markConversationReadApi = async (conversationId) => {
  const response = await fetch(`/api/chat/conversations/${conversationId}/read`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const fetchUnreadChatCountApi = async () => {
  const response = await fetch('/api/chat/unread-count', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};
