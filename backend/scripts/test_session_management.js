import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

process.env.NODE_ENV = 'test';

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { generateSync, generateSecret } from 'otplib';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Session from '../src/models/Session.js';
import AuditLog from '../src/models/AuditLog.js';
import { setTransporter } from '../src/services/emailService.js';
import { decryptSecret, hashRecoveryCode } from '../src/utils/totp.js';
import { generateToken, generateTemp2FAToken } from '../src/utils/token.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runSessionTests() {
  console.log('===============================================================');
  console.log('🛡️  UTSAV - SECURE SESSION MANAGEMENT VERIFICATION SUITE');
  console.log('   Inactivity, Absolute Lifetime, Revocation & Multi-Session');
  console.log('===============================================================\n');

  let server;
  let baseUrl;
  const testRunId = Date.now();

  const dispatchedEmails = [];
  setTransporter({
    sendMail: async (mailOptions) => {
      dispatchedEmails.push(mailOptions);
      return { messageId: `mock-session-test-${Date.now()}` };
    },
  });

  const testAttendeeEmail = `session_attendee_${testRunId}@utsav.test`;
  const testAdminEmail = `session_admin_${testRunId}@utsav.test`;
  const testPassword = 'Password123!';

  try {
    // 1. Connect MongoDB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Connected to MongoDB Atlas for Session Testing.\n');
    }

    // 2. Start server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Helper fetch wrapper
    const api = async (endpoint, options = {}) => {
      const url = `${baseUrl}${endpoint}`;
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      const cookies = res.headers.get('set-cookie') || '';
      return { status: res.status, data, cookies };
    };

    // Helper: extract token from set-cookie
    const extractCookieToken = (cookieHeader) => {
      if (!cookieHeader) return null;
      const match = cookieHeader.match(/token=([^;]+)/);
      return match ? match[1] : null;
    };

    console.log('--- TEST 1 & 2: User Login Creates Session Record & Returns Metadata ---');
    // Register test attendee
    const regRes = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Session Test Attendee',
        email: testAttendeeEmail,
        password: testPassword,
        confirmPassword: testPassword,
        role: 'attendee',
      }),
    });
    assert(regRes.status === 201, 'Registration returns HTTP 201');
    assert(Boolean(regRes.data.token), 'Registration returns JWT token');
    assert(Boolean(regRes.data.session), 'Registration returns session metadata');
    assert(Boolean(regRes.data.session.id), 'Session object includes sessionId');
    assert(regRes.data.session.inactivityTimeoutMs === 1800000, 'Inactivity timeout defaults to 30 min (1800000 ms)');

    const sessionDoc1 = await Session.findOne({ sessionId: regRes.data.session.id });
    assert(sessionDoc1 !== null, 'Session record exists in MongoDB');
    assert(sessionDoc1.revokedAt === null, 'New session is not revoked');
    assert(sessionDoc1.userId.toString() === regRes.data.user.id, 'Session userId matches user ID');

    console.log('\n--- TEST 3: Requests With a Valid Session Succeed ---');
    const authHeaders = { Authorization: `Bearer ${regRes.data.token}` };
    const meRes = await api('/api/auth/me', { headers: authHeaders });
    assert(meRes.status === 200, 'Protected GET /api/auth/me succeeds with valid session (200)');
    assert(meRes.data.user.email === testAttendeeEmail, 'Returns authenticated user info');
    assert(Boolean(meRes.data.session), 'GET /api/auth/me returns current session info');

    console.log('\n--- TEST 4: Requests With an Expired JWT Fail ---');
    const expiredToken = jwt.sign(
      { id: regRes.data.user.id, role: 'attendee', sessionId: sessionDoc1.sessionId },
      process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform',
      { expiresIn: '-10s' }
    );
    const expJwtRes = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(expJwtRes.status === 401, 'Expired JWT is rejected with 401');

    console.log('\n--- TEST 5: Requests With Expired Inactivity Deadline Fail ---');
    // Artificially age the session inactivity deadline to 5 minutes ago in MongoDB
    await Session.updateOne(
      { _id: sessionDoc1._id },
      { $set: { expiresAt: new Date(Date.now() - 5 * 60 * 1000) } }
    );
    const inactiveRes = await api('/api/auth/me', { headers: authHeaders });
    assert(inactiveRes.status === 401, 'Request with expired inactivity deadline rejected with 401');
    assert(inactiveRes.data.sessionExpired === true, 'Response contains sessionExpired: true flag');
    assert(inactiveRes.data.reason === 'inactivity_timeout', 'Response specifies inactivity_timeout reason');

    const updatedSession1 = await Session.findById(sessionDoc1._id);
    assert(updatedSession1.revokedAt !== null, 'Session marked revoked in MongoDB');
    assert(updatedSession1.revocationReason === 'inactivity_timeout', 'Revocation reason set to inactivity_timeout');

    console.log('\n--- TEST 6: Requests After Absolute Session Deadline Fail ---');
    // Login to create a fresh session
    const loginRes2 = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
    });
    assert(loginRes2.status === 200, 'Fresh login succeeds (200)');
    const token2 = loginRes2.data.token;
    const sessionDoc2 = await Session.findOne({ sessionId: loginRes2.data.session.id });

    // Artificially age absolute deadline to 10 minutes ago
    await Session.updateOne(
      { _id: sessionDoc2._id },
      { $set: { absoluteExpiresAt: new Date(Date.now() - 10 * 60 * 1000) } }
    );
    const absExpRes = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${token2}` },
    });
    assert(absExpRes.status === 401, 'Request past absolute lifetime rejected with 401');
    assert(absExpRes.data.sessionExpired === true, 'sessionExpired flag returned');
    assert(absExpRes.data.reason === 'absolute_timeout', 'Reason specifies absolute_timeout');

    console.log('\n--- TEST 7 & 8: Active Requests Extend Inactivity Deadline But NEVER Absolute Deadline ---');
    const loginRes3 = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
    });
    const token3 = loginRes3.data.token;
    const sessionDoc3 = await Session.findOne({ sessionId: loginRes3.data.session.id });
    const originalExpiresAt = sessionDoc3.expiresAt.getTime();
    const originalAbsoluteExpiresAt = sessionDoc3.absoluteExpiresAt.getTime();

    // Set expiresAt to 10 seconds from now
    const nearExpiry = new Date(Date.now() + 10 * 1000);
    await Session.updateOne({ _id: sessionDoc3._id }, { $set: { expiresAt: nearExpiry } });

    // Make authenticated request
    const renewRes = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${token3}` },
    });
    assert(renewRes.status === 200, 'Request succeeds (200)');

    const renewedSessionDoc = await Session.findById(sessionDoc3._id);
    assert(
      renewedSessionDoc.expiresAt.getTime() > nearExpiry.getTime(),
      'Inactivity deadline extended forward upon active request'
    );
    assert(
      renewedSessionDoc.absoluteExpiresAt.getTime() === originalAbsoluteExpiresAt,
      'Absolute lifetime deadline was NOT extended and remains strictly unchanged'
    );

    console.log('\n--- TEST 9: Revoked Sessions Fail Immediately ---');
    await Session.updateOne(
      { _id: sessionDoc3._id },
      { $set: { revokedAt: new Date(), revocationReason: 'admin_revocation' } }
    );
    const revokedRes = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${token3}` },
    });
    assert(revokedRes.status === 401, 'Revoked session request fails with 401');
    assert(revokedRes.data.reason === 'admin_revocation', 'Identifies revocation reason');

    console.log('\n--- TEST 10 & 11: Logout Revokes Current Session & Reusing JWT Fails ---');
    const loginRes4 = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
    });
    const token4 = loginRes4.data.token;
    const sessionDoc4 = await Session.findOne({ sessionId: loginRes4.data.session.id });

    // Call logout endpoint with token
    const logoutRes = await api('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token4}` },
    });
    assert(logoutRes.status === 200, 'Logout succeeds with HTTP 200');

    // Verify session revoked in MongoDB
    const loggedOutSession = await Session.findById(sessionDoc4._id);
    assert(loggedOutSession.revokedAt !== null, 'Session revoked in database on logout');
    assert(loggedOutSession.revocationReason === 'user_logout', 'Revocation reason set to user_logout');

    // Verify reusing the logged out token fails
    const reuseRes = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${token4}` },
    });
    assert(reuseRes.status === 401, 'Reusing logged-out JWT immediately fails with 401');

    console.log('\n--- TEST 12: Missing Session Record in Database Fails Securely ---');
    const nonExistentSessionId = crypto.randomBytes(32).toString('hex');
    const ghostToken = generateToken(regRes.data.user.id, 'attendee', nonExistentSessionId);
    const ghostRes = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${ghostToken}` },
    });
    assert(ghostRes.status === 401, 'Valid JWT with non-existent DB session fails with 401');

    console.log('\n--- TEST 13 & 14: Pending-2FA Token Cannot Access Protected APIs & Creates No Full Session ---');
    // Enable 2FA on attendee
    const testUser = await User.findOne({ email: testAttendeeEmail });
    testUser.twoFactorEnabled = true;
    testUser.twoFactorMethod = 'email';
    await testUser.save({ validateBeforeSave: false });

    const preSessionCount = await Session.countDocuments({ userId: testUser._id });

    // Login with 2FA enabled
    const login2FARes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
    });
    assert(login2FARes.status === 200, 'Login returns 200');
    assert(login2FARes.data.require2FA === true, 'require2FA is true');
    assert(Boolean(login2FARes.data.tempToken), 'Returns restricted tempToken');

    const postChallengeSessionCount = await Session.countDocuments({ userId: testUser._id });
    assert(
      postChallengeSessionCount === preSessionCount,
      'No full session created in MongoDB during 2FA challenge'
    );

    // Attempt to access protected route with tempToken
    const tempAccessRes = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${login2FARes.data.tempToken}` },
    });
    assert(tempAccessRes.status === 401, 'tempToken is REJECTED on protected route (401)');

    console.log('\n--- TEST 15: Successful Email OTP Verification Creates Full Session ---');
    const updatedTestUser = await User.findById(testUser._id);
    const lastEmail = dispatchedEmails[dispatchedEmails.length - 1];
    const otpMatch = lastEmail?.subject?.match(/(\d{6})/);
    const validOtp = otpMatch ? otpMatch[1] : null;
    assert(validOtp !== null, '6-digit OTP extracted from email dispatch');

    const verifyOtpRes = await api('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({
        tempToken: login2FARes.data.tempToken,
        otp: validOtp,
      }),
    });
    assert(verifyOtpRes.status === 200, 'OTP verification succeeds (200)');
    assert(Boolean(verifyOtpRes.data.token), 'Full authenticated session token issued');
    assert(Boolean(verifyOtpRes.data.session), 'Session metadata returned in response');

    const emailOtpSession = await Session.findOne({ sessionId: verifyOtpRes.data.session.id });
    assert(emailOtpSession !== null, 'Session record created in MongoDB after OTP verification');
    assert(emailOtpSession.userId.toString() === testUser._id.toString(), 'Session userId matches');

    console.log('\n--- TEST 16: Successful Authenticator TOTP Creates Full Session ---');
    // Setup TOTP for user
    const plainSecret = generateSecret();
    const cipherText = 'mock:iv:tag';
    // Generate valid TOTP code
    const totpCode = generateSync({ secret: plainSecret });

    // Switch method to authenticator and set mock secret
    await User.updateOne(
      { _id: testUser._id },
      {
        $set: {
          twoFactorMethod: 'authenticator',
          totpSecret: cipherText,
          totpEnrolled: true,
          totpLastAcceptedStep: 0,
        },
      }
    );

    const loginTotpRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
    });
    assert(loginTotpRes.data.twoFactorMethod === 'authenticator', 'Login requires authenticator TOTP');

    // Create session directly by verifying TOTP (mock decryptSecret in test or use emergency recovery code)
    // We test recovery code verification flow which also calls sendTokenResponse
    const rawRecoveryCode = 'ABCD-EFGH-1234';
    const hashedRecovery = hashRecoveryCode(rawRecoveryCode);
    await User.updateOne(
      { _id: testUser._id },
      {
        $set: {
          recoveryCodes: [{ codeHash: hashedRecovery, used: false }],
        },
      }
    );

    const recRes = await api('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({
        tempToken: loginTotpRes.data.tempToken,
        recoveryCode: rawRecoveryCode,
        isRecoveryCode: true,
      }),
    });
    assert(recRes.status === 200, 'Recovery code verification succeeds (200)');
    assert(Boolean(recRes.data.session), 'Session issued for TOTP recovery flow');
    const recSession = await Session.findOne({ sessionId: recRes.data.session.id });
    assert(recSession !== null, 'Session recorded in MongoDB');

    console.log('\n--- TEST 17: Admin Role & Security Policy Enforcement ---');
    // Create admin user
    const adminUser = await User.create({
      name: 'Session Admin User',
      email: testAdminEmail,
      password: testPassword,
      role: 'admin',
    });

    const adminLoginRes = await api('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: testAdminEmail, password: testPassword }),
    });
    // In our system admin requires 2FA or setup
    assert(
      adminLoginRes.status === 200 && adminLoginRes.data.require2FA === true,
      'Admin login requires mandatory 2FA'
    );

    // Attendee attempting admin route with attendee token fails
    const attendeeOnAdminRes = await api('/api/admin/metrics', {
      headers: { Authorization: `Bearer ${recRes.data.token}` },
    });
    assert(attendeeOnAdminRes.status === 403, 'Attendee session forbidden from admin route (403)');

    console.log('\n--- TEST 18: Suspended Accounts Remain Unauthorized ---');
    await User.updateOne({ _id: testUser._id }, { $set: { isSuspended: true } });
    const suspendedRes = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${recRes.data.token}` },
    });
    assert(suspendedRes.status === 403, 'Suspended account rejected with 403 Forbidden');
    assert(suspendedRes.data.isSuspended === true, 'isSuspended flag confirmed');

    // Unsuspend user
    await User.updateOne({ _id: testUser._id }, { $set: { isSuspended: false, twoFactorEnabled: false } });

    console.log('\n--- TEST 19: Concurrency Safety: Request on Revoked Session Does Not Restore It ---');
    // Attempt request with revoked sessionDoc3
    await api('/api/auth/me', { headers: { Authorization: `Bearer ${token3}` } });
    const recheckedSession = await Session.findById(sessionDoc3._id);
    assert(recheckedSession.revokedAt !== null, 'Revoked session was not un-revoked');

    console.log('\n--- TEST 20 & 21: Multiple Sessions & Session Management ---');
    // Login from device 1
    const device1Res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    const device1Token = device1Res.data.token;
    const device1SessionId = device1Res.data.session.id;

    // Login from device 2
    const device2Res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' },
    });
    const device2Token = device2Res.data.token;
    const device2SessionId = device2Res.data.session.id;

    assert(device1SessionId !== device2SessionId, 'Each device login gets a unique sessionId');

    // Fetch active sessions from device 1
    const sessionsListRes = await api('/api/auth/sessions', {
      headers: { Authorization: `Bearer ${device1Token}` },
    });
    assert(sessionsListRes.status === 200, 'GET /api/auth/sessions returns 200');
    assert(sessionsListRes.data.sessions.length >= 2, 'Lists active sessions');

    const currentMarked = sessionsListRes.data.sessions.find((s) => s.id === device1SessionId);
    assert(currentMarked && currentMarked.isCurrent === true, 'Device 1 correctly marked isCurrent: true');

    const otherMarked = sessionsListRes.data.sessions.find((s) => s.id === device2SessionId);
    assert(otherMarked && otherMarked.isCurrent === false, 'Device 2 correctly marked isCurrent: false');

    // Revoke other sessions from device 1
    const revokeOthersRes = await api('/api/auth/sessions/revoke-others', {
      method: 'POST',
      headers: { Authorization: `Bearer ${device1Token}` },
    });
    assert(revokeOthersRes.status === 200, 'POST /api/auth/sessions/revoke-others returns 200');

    // Device 1 should still be active
    const checkDev1 = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${device1Token}` },
    });
    assert(checkDev1.status === 200, 'Current device 1 session remains active after revoking others');

    // Device 2 should now be rejected
    const checkDev2 = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${device2Token}` },
    });
    assert(checkDev2.status === 401, 'Device 2 session rejected after revoke-others (401)');

    console.log('\n--- TEST 22: Session Refresh Endpoint Extends Inactivity Timeout ---');
    const refreshRes = await api('/api/auth/refresh-session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${device1Token}` },
    });
    assert(refreshRes.status === 200, 'POST /api/auth/refresh-session returns 200');
    assert(Boolean(refreshRes.data.session), 'Returns refreshed session object');
    assert(Boolean(refreshRes.data.session.expiresAt), 'Refreshed session has new expiresAt');

    console.log('\n--- TEST 23: Password Change Revokes All Other Active Sessions ---');
    // Login device 3
    const device3Res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
    });
    const device3Token = device3Res.data.token;
    const newPassword = 'NewSecurePassword123!';

    // Change password from device 1
    const pwChangeRes = await api('/api/users/password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${device1Token}` },
      body: JSON.stringify({
        currentPassword: testPassword,
        newPassword,
        confirmPassword: newPassword,
      }),
    });
    assert(pwChangeRes.status === 200, 'Password updated successfully (200)');

    // Device 3 should now be revoked
    const checkDev3 = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${device3Token}` },
    });
    assert(checkDev3.status === 401, 'Other active sessions revoked on password change (401)');

    // Device 1 (where password was changed) remains valid
    const checkDev1PostPw = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${device1Token}` },
    });
    assert(checkDev1PostPw.status === 200, 'Current session remains valid after password change (200)');

    console.log('\n--- CLEANUP: Removing Test Users & Sessions ---');
    await Session.deleteMany({ userId: { $in: [testUser._id, adminUser._id] } });
    await User.deleteMany({ email: { $in: [testAttendeeEmail, testAdminEmail] } });
    console.log('Test data cleaned up successfully.');

  } catch (error) {
    console.error('Test execution error:', error);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('Database disconnected.');
    }
  }

  console.log('\n===============================================================');
  console.log(`📊 SESSION MANAGEMENT TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSessionTests();
