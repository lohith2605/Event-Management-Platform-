/**
 * UTSAV — Coupon Codes & Discount Management API Client
 * Provides secure communication for attendee checkout, organizer coupon CRUD,
 * and administrative oversight.
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

// ----------------- ATTENDEE CHECKOUT -----------------

/**
 * Validate a coupon code and preview server-calculated discount on checkout
 */
export const validateCouponApi = async ({ eventId, quantity = 1, code }) => {
  const response = await fetch('/api/bookings/validate-coupon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ eventId, quantity, code }),
  });
  return handleResponse(response);
};

// ----------------- ORGANIZER MANAGEMENT -----------------

/**
 * Fetch organizer's coupons with filtering and search
 */
export const fetchOrganizerCouponsApi = async (params = {}) => {
  const qs = buildQueryString(params);
  const response = await fetch(`/api/organizer/coupons${qs}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Fetch organizer coupon performance metrics
 */
export const fetchOrganizerCouponStatsApi = async () => {
  const response = await fetch('/api/organizer/coupons/stats', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Fetch a single organizer coupon by ID with redemption history
 */
export const fetchOrganizerCouponByIdApi = async (id) => {
  const response = await fetch(`/api/organizer/coupons/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Create a new coupon for organizer's events
 */
export const createOrganizerCouponApi = async (couponData) => {
  const response = await fetch('/api/organizer/coupons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(couponData),
  });
  return handleResponse(response);
};

/**
 * Update an existing coupon
 */
export const updateOrganizerCouponApi = async (id, couponData) => {
  const response = await fetch(`/api/organizer/coupons/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(couponData),
  });
  return handleResponse(response);
};

/**
 * Toggle coupon active/inactive status
 */
export const toggleOrganizerCouponStatusApi = async (id, isActive) => {
  const response = await fetch(`/api/organizer/coupons/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ isActive }),
  });
  return handleResponse(response);
};

/**
 * Delete a coupon (only permitted if zero redemptions)
 */
export const deleteOrganizerCouponApi = async (id) => {
  const response = await fetch(`/api/organizer/coupons/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

// ----------------- ADMIN GOVERNANCE -----------------

/**
 * Fetch cross-organizer platform coupons
 */
export const fetchAdminCouponsApi = async (params = {}) => {
  const qs = buildQueryString(params);
  const response = await fetch(`/api/admin/coupons${qs}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Fetch platform-wide coupon aggregate metrics
 */
export const fetchAdminCouponStatsApi = async () => {
  const response = await fetch('/api/admin/coupons/stats', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

/**
 * Admin status toggle with reason for audit log
 */
export const updateAdminCouponStatusApi = async (id, { isActive, reason }) => {
  const response = await fetch(`/api/admin/coupons/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ isActive, reason }),
  });
  return handleResponse(response);
};
