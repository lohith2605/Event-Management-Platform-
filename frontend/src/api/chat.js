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

export const fetchMessagesApi = async (
  conversationId,
  { limit = 50, before, includeMessageId } = {}
) => {
  let url = `/api/chat/conversations/${conversationId}/messages?limit=${encodeURIComponent(limit)}`;
  if (before) {
    const beforeIso = before instanceof Date ? before.toISOString() : before;
    url += `&before=${encodeURIComponent(beforeIso)}`;
  }
  if (includeMessageId) {
    url += `&includeMessageId=${encodeURIComponent(includeMessageId)}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const searchMessagesApi = async (
  conversationId,
  { query, page = 1, limit = 20 } = {},
  signal
) => {
  const url = `/api/chat/conversations/${conversationId}/messages/search?q=${encodeURIComponent(
    query
  )}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
  });
  return handleResponse(response);
};

export const sendMessageApi = async (conversationId, payload) => {
  const body = typeof payload === 'string' ? { text: payload } : payload;
  const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return handleResponse(response);
};

export const forwardMessageApi = async (targetConversationId, sourceMessageId) => {
  const response = await fetch(`/api/chat/conversations/${targetConversationId}/messages/forward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ sourceMessageId }),
  });
  return handleResponse(response);
};

export const uploadChatAttachmentApi = async (conversationId, file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/api/chat/conversations/${conversationId}/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  return handleResponse(response);
};

// Backward-compatible alias
export const uploadChatImageApi = uploadChatAttachmentApi;

export const downloadAttachmentApi = async (
  conversationId,
  messageId,
  filename = 'download',
  action = 'download'
) => {
  const url = `/api/chat/conversations/${conversationId}/messages/${messageId}/download${
    action === 'open' ? '?action=open' : ''
  }`;

  if (action === 'open') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to download attachment.');
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename || 'download';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
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

export const toggleReactionApi = async (conversationId, messageId, emoji) => {
  const response = await fetch(
    `/api/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ emoji }),
    }
  );
  return handleResponse(response);
};

export const editMessageApi = async (conversationId, messageId, text) => {
  const response = await fetch(
    `/api/chat/conversations/${conversationId}/messages/${messageId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text }),
    }
  );
  return handleResponse(response);
};

export const deleteMessageApi = async (conversationId, messageId) => {
  const response = await fetch(
    `/api/chat/conversations/${conversationId}/messages/${messageId}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }
  );
  return handleResponse(response);
};

export const pinMessageApi = async (conversationId, messageId) => {
  const response = await fetch(
    `/api/chat/conversations/${conversationId}/messages/${messageId}/pin`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ messageId }),
    }
  );
  return handleResponse(response);
};

export const unpinMessageApi = async (conversationId, messageId) => {
  const url = messageId
    ? `/api/chat/conversations/${conversationId}/messages/${messageId}/pin`
    : `/api/chat/conversations/${conversationId}/pin`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ messageId }),
  });
  return handleResponse(response);
};

export const fetchSharedContentApi = async (
  conversationId,
  { type = 'media', page = 1, limit = 30 } = {}
) => {
  const query = new URLSearchParams({
    type,
    page: String(page),
    limit: String(limit),
  });
  const response = await fetch(
    `/api/chat/conversations/${conversationId}/shared?${query.toString()}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }
  );
  return handleResponse(response);
};

export const deleteConversationApi = async (conversationId) => {
  const response = await fetch(`/api/chat/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const fetchPresenceApi = async (userIds = []) => {
  const query = Array.isArray(userIds) && userIds.length > 0
    ? `?userIds=${encodeURIComponent(userIds.join(','))}`
    : '';
  const response = await fetch(`/api/chat/presence${query}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};



