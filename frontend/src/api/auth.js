
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

export const verify2FAApi = async ({ tempToken, otp, code, recoveryCode, isRecoveryCode }) => {
  const response = await fetch('/api/auth/verify-2fa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tempToken, otp, code, recoveryCode, isRecoveryCode }),
  });
  return handleResponse(response);
};

export const resend2FAApi = async ({ tempToken }) => {
  const response = await fetch('/api/auth/resend-2fa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tempToken }),
  });
  return handleResponse(response);
};

export const toggle2FAApi = async ({ enabled, currentPassword, googleIdToken }) => {
  const response = await fetch('/api/users/2fa-toggle', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ enabled, currentPassword, googleIdToken }),
  });
  return handleResponse(response);
};

export const setupAuthenticatorApi = async ({ tempToken } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (tempToken) {
    headers['Authorization'] = `Bearer ${tempToken}`;
  }
  const response = await fetch('/api/users/2fa/authenticator/setup', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ tempToken }),
  });
  return handleResponse(response);
};

export const verifyAuthenticatorSetupApi = async ({ code, currentPassword, tempToken }) => {
  const headers = { 'Content-Type': 'application/json' };
  if (tempToken) {
    headers['Authorization'] = `Bearer ${tempToken}`;
  }
  const response = await fetch('/api/users/2fa/authenticator/verify-setup', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ code, currentPassword, tempToken }),
  });
  return handleResponse(response);
};

export const disableAuthenticatorApi = async ({ currentPassword }) => {
  const response = await fetch('/api/users/2fa/authenticator/disable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ currentPassword }),
  });
  return handleResponse(response);
};

export const regenerateRecoveryCodesApi = async ({ currentPassword }) => {
  const response = await fetch('/api/users/2fa/authenticator/recovery-codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ currentPassword }),
  });
  return handleResponse(response);
};

export const refreshSessionApi = async () => {
  const response = await fetch('/api/auth/refresh-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const getSessionsApi = async () => {
  const response = await fetch('/api/auth/sessions', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const revokeSessionApi = async (sessionId) => {
  const response = await fetch(`/api/auth/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};

export const revokeOtherSessionsApi = async () => {
  const response = await fetch('/api/auth/sessions/revoke-others', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return handleResponse(response);
};



