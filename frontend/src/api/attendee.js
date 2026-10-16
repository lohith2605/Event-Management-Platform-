/**
 * UTSAV — Attendee Dashboard & Supporting Services API Client
 * Uses HTTP-only cookie sessions with relative endpoints proxied by Vite
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

// ----------------- BOOKINGS -----------------
export const fetchAttendeeStatsApi = async () => {
  const res = await fetch('/api/bookings/overview-stats', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(res);
};

export const fetchMyBookingsApi = async (status = '') => {
  const url = status && status !== 'all'
    ? `/api/bookings/my-bookings?status=${encodeURIComponent(status)}`
    : '/api/bookings/my-bookings';
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(res);
};

export const fetchBookingByIdApi = async (id) => {
  const res = await fetch(`/api/bookings/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(res);
};

export const createBookingApi = async ({
  eventId,
  quantity = 1,
  ticketType = 'General Admission',
  notes = '',
  couponCode = '',
}) => {
  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ eventId, quantity, ticketType, notes, couponCode }),
  });
  return handleResponse(res);
};

export const cancelBookingApi = async (id, reason = 'Cancelled by attendee') => {
  const res = await fetch(`/api/bookings/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ reason }),
  });
  return handleResponse(res);
};

// ----------------- TICKETS -----------------
export const fetchMyTicketsApi = async (status = 'valid') => {
  const url = status ? `/api/tickets/my-tickets?status=${encodeURIComponent(status)}` : '/api/tickets/my-tickets';
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(res);
};

export const fetchTicketByIdApi = async (id) => {
  const res = await fetch(`/api/tickets/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(res);
};

// ----------------- NOTIFICATIONS -----------------
export const fetchNotificationsApi = async () => {
  const res = await fetch('/api/notifications', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(res);
};

export const markNotificationReadApi = async (id) => {
  const res = await fetch(`/api/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(res);
};

export const markAllNotificationsReadApi = async () => {
  const res = await fetch('/api/notifications/read-all', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(res);
};

// ----------------- REVIEWS -----------------
export const fetchEventReviewsApi = async (eventId) => {
  const res = await fetch(`/api/reviews/event/${eventId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  return handleResponse(res);
};

export const fetchMyReviewsApi = async () => {
  const res = await fetch('/api/reviews/my-reviews', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(res);
};

export const submitReviewApi = async ({ eventId, rating, comment }) => {
  const res = await fetch('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ eventId, rating, comment }),
  });
  return handleResponse(res);
};

// ----------------- USER PROFILE & SECURITY -----------------
export const fetchProfileApi = async () => {
  const res = await fetch('/api/users/profile', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(res);
};

export const updateProfileApi = async (profileData) => {
  const res = await fetch('/api/users/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(profileData),
  });
  return handleResponse(res);
};

export const updatePasswordApi = async ({ currentPassword, newPassword, confirmPassword }) => {
  const res = await fetch('/api/users/password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });
  return handleResponse(res);
};

// ----------------- RAZORPAY PAYMENTS -----------------
export const createPaymentOrderApi = async (bookingId) => {
  const res = await fetch('/api/payments/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ bookingId }),
  });
  return handleResponse(res);
};

export const verifyPaymentApi = async ({
  bookingId,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  const res = await fetch('/api/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      bookingId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    }),
  });
  return handleResponse(res);
};

export const recordPaymentFailureApi = async ({ bookingId, razorpay_order_id, error }) => {
  const res = await fetch('/api/payments/failure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ bookingId, razorpay_order_id, error }),
  });
  return handleResponse(res);
};

