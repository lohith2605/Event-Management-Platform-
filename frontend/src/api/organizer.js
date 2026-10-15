/**
 * UTSAV — Organizer Dashboard API Client
 * Connects securely to protected organizer endpoints using HTTP-only cookie sessions.
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
 * Fetch organizer overview metrics (events, attendees, revenue, upcoming events, recent bookings)
 */
export const fetchOrganizerOverviewApi = async (scope = '') => {
  const url = scope ? `/api/organizer/overview?scope=${encodeURIComponent(scope)}` : '/api/organizer/overview';
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Fetch organizer events with status filter, search, and pagination
 */
export const fetchOrganizerEventsListApi = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      searchParams.append(key, value);
    }
  });

  const query = searchParams.toString();
  const url = query ? `/api/organizer/events?${query}` : '/api/organizer/events';

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Fetch a single organizer event by ID with ticket tier breakdown
 */
export const fetchOrganizerEventByIdApi = async (id) => {
  const response = await fetch(`/api/organizer/events/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Create a new event (submitted for admin approval)
 */
export const createOrganizerEventApi = async (eventData) => {
  const response = await fetch('/api/organizer/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(eventData),
  });
  return handleResponse(response);
};

/**
 * Update an existing event authored by the organizer
 */
export const updateOrganizerEventApi = async (id, eventData) => {
  const response = await fetch(`/api/organizer/events/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(eventData),
  });
  return handleResponse(response);
};

/**
 * Cancel an event authored by the organizer
 */
export const cancelOrganizerEventApi = async (id, reason) => {
  const response = await fetch(`/api/organizer/events/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ reason }),
  });
  return handleResponse(response);
};

/**
 * Fetch bookings associated with organizer's events
 */
export const fetchOrganizerBookingsApi = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      searchParams.append(key, value);
    }
  });

  const query = searchParams.toString();
  const url = query ? `/api/organizer/bookings?${query}` : '/api/organizer/bookings';

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Fetch attendee roster across organizer's events
 */
export const fetchOrganizerAttendeesApi = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      searchParams.append(key, value);
    }
  });

  const query = searchParams.toString();
  const url = query ? `/api/organizer/attendees?${query}` : '/api/organizer/attendees';

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Fetch organizer genuine analytics and performance metrics
 */
export const fetchOrganizerAnalyticsApi = async () => {
  const response = await fetch('/api/organizer/analytics', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Fetch organizer user profile
 */
export const fetchOrganizerProfileApi = async () => {
  const response = await fetch('/api/users/profile', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Update organizer profile details (name, phone, bio, city)
 */
export const updateOrganizerProfileApi = async (profileData) => {
  const response = await fetch('/api/users/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(profileData),
  });
  return handleResponse(response);
};

/**
 * Change organizer account password
 */
export const updateOrganizerPasswordApi = async (passwordData) => {
  const response = await fetch('/api/users/password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(passwordData),
  });
  return handleResponse(response);
};
