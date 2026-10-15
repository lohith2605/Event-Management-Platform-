/**
 * UTSAV — Dedicated Admin Portal API Client
 * Strict authentication via HTTP-only cookie sessions and backend authorization.
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

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      searchParams.append(key, value);
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
};

// 1. Stats & Overview
export const fetchAdminStatsApi = async () => {
  const response = await fetch('/api/admin/stats', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

// 2. Events & Moderation
export const fetchAdminEventsApi = async (params = {}) => {
  const qs = buildQueryString(params);
  const response = await fetch(`/api/admin/events${qs}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const fetchAdminPendingEventsApi = async () => {
  const response = await fetch('/api/admin/events/pending', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const fetchAdminEventByIdApi = async (id) => {
  const response = await fetch(`/api/admin/events/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const reviewAdminEventApi = async (id, { action, rejectionReason }) => {
  const response = await fetch(`/api/admin/events/${id}/review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action, rejectionReason }),
  });
  return handleResponse(response);
};

// 3. User Governance
export const fetchAdminUsersApi = async (params = {}) => {
  const qs = buildQueryString(params);
  const response = await fetch(`/api/admin/users${qs}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const fetchAdminUserByIdApi = async (id) => {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const updateAdminUserStatusApi = async (id, { action, reason }) => {
  const response = await fetch(`/api/admin/users/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action, reason }),
  });
  return handleResponse(response);
};

// 4. Bookings & Payments
export const fetchAdminBookingsApi = async (params = {}) => {
  const qs = buildQueryString(params);
  const response = await fetch(`/api/admin/bookings${qs}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const fetchAdminBookingByIdApi = async (id) => {
  const response = await fetch(`/api/admin/bookings/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const cancelAndRefundAdminBookingApi = async (id, reason) => {
  const response = await fetch(`/api/admin/bookings/${id}/cancel-refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ reason }),
  });
  return handleResponse(response);
};

// 5. Review Moderation
export const fetchAdminReviewsApi = async (params = {}) => {
  const qs = buildQueryString(params);
  const response = await fetch(`/api/admin/reviews${qs}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const moderateAdminReviewApi = async (id, { action, reason }) => {
  const response = await fetch(`/api/admin/reviews/${id}/moderate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action, reason }),
  });
  return handleResponse(response);
};

// 6. Audit Logs
export const fetchAdminAuditLogsApi = async (params = {}) => {
  const qs = buildQueryString(params);
  const response = await fetch(`/api/admin/audit-logs${qs}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

// 7. Notifications
export const fetchAdminNotificationsApi = async () => {
  const response = await fetch('/api/admin/notifications', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const markAdminNotificationReadApi = async (id) => {
  const response = await fetch(`/api/admin/notifications/${id}/read`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const markAllAdminNotificationsReadApi = async () => {
  const response = await fetch('/api/admin/notifications/read-all', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};
