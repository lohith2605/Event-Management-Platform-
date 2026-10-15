
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

export const registerApi = async ({ name, email, password, confirmPassword, role }) => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, email, password, confirmPassword, role }),
  });
  return handleResponse(response);
};

export const loginApi = async ({ email, password }) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(response);
};

export const adminLoginApi = async ({ email, password }) => {
  const response = await fetch('/api/auth/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(response);
};

export const getMeApi = async () => {
  const response = await fetch('/api/auth/me', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const logoutApi = async () => {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const forgotPasswordApi = async (email) => {
  const response = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });
  return handleResponse(response);
};

export const resetPasswordApi = async (token, password, confirmPassword) => {
  const response = await fetch(`/api/auth/reset-password/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password, confirmPassword }),
  });
  return handleResponse(response);
};

export const googleAuthApi = async (idToken) => {
  const response = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken }),
  });
  return handleResponse(response);
};

