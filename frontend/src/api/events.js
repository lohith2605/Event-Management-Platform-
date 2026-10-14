/**
 * UTSAV — Event & Statistics API Client
 * Connects to live MongoDB Atlas endpoints via Vite proxy
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
 * Fetch genuine published upcoming events with filters
 */
export const fetchPublishedEventsApi = async (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'All' && value !== 'All Cities' && value !== 'All Formats') {
      searchParams.append(key, value);
    }
  });

  const queryString = searchParams.toString();
  const url = queryString ? `/api/events?${queryString}` : '/api/events';

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  return handleResponse(response);
};

/**
 * Fetch live aggregate category counts from published events
 */
export const fetchCategoryCountsApi = async () => {
  const response = await fetch('/api/events/categories', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  return handleResponse(response);
};

/**
 * Fetch events published by the authenticated organizer
 */
export const fetchOrganizerEventsApi = async () => {
  const response = await fetch('/api/events/organizer/my-events', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
};

/**
 * Fetch genuine system statistics for the admin dashboard
 */
export const fetchAdminStatsApi = async () => {
  const response = await fetch('/api/admin/stats', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  return handleResponse(response);
};
