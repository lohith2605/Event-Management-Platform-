import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

process.env.NODE_ENV = 'test';

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { generateSync } from 'otplib';
import app from '../src/app.js';
import User from '../src/models/User.js';
import AuditLog from '../src/models/AuditLog.js';
import { setTransporter } from '../src/services/emailService.js';
import { decryptSecret } from '../src/utils/totp.js';

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

async function run2FATests() {
  console.log('===============================================================');
  console.log('🔐 UTSAV - TWO-FACTOR AUTHENTICATION (2FA) COMPREHENSIVE SUITE');
  console.log('   Includes Google Authenticator (TOTP), Recovery, and Email OTP');
  console.log('===============================================================\n');

  let server;
  let baseUrl;
  const testRunId = Date.now();
  const testAttendeeEmail = `test_att_2fa_${testRunId}@utsav-test.local`;
  const testAdminEmail = `test_admin_2fa_${testRunId}@utsav-test.local`;
  const testOrganizerEmail = `test_org_2fa_${testRunId}@utsav-test.local`;
  const testPassword = 'Password123!Secure';

  const sentEmails = [];
  const mockTransporter = {
    sendMail: async (mailOptions) => {
      sentEmails.push(mailOptions);
      return { messageId: `mock-msg-${Date.now()}` };
    },
  };

  let attendeeUser;
  let adminUser;
  let organizerUser;

  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    console.log(`Ephemeral test server running at ${baseUrl}\n`);

    setTransporter(mockTransporter);

    const apiRequest = async (path, options = {}) => {
      const url = `${baseUrl}${path}`;
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      const res = await fetch(url, { ...options, headers });
      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { raw: text };
      }
      return { status: res.status, headers: res.headers, data };
    };

    const getLatestSentOtp = () => {
      if (sentEmails.length === 0) return null;
      const latest = sentEmails[sentEmails.length - 1];
      const match = latest.subject.match(/(\d{6})/);
      return match ? match[1] : null;
    };

    // =========================================================================
    // SETUP TEST USERS
    // =========================================================================
    console.log('--- SETUP: Creating Test Accounts ---');
    attendeeUser = await User.create({
      name: 'Test Attendee 2FA',
      email: testAttendeeEmail,
      password: testPassword,
      role: 'attendee',
      twoFactorEnabled: false,
      twoFactorMethod: 'email',
    });

    adminUser = await User.create({
      name: 'Test Admin 2FA',
      email: testAdminEmail,
      password: testPassword,
      role: 'admin',
      twoFactorEnabled: true,
      twoFactorMethod: 'authenticator',
      totpEnrolled: false, // Starts unenrolled to test mandatory setup
    });

    organizerUser = await User.create({
      name: 'Test Organizer 2FA',
      email: testOrganizerEmail,
      password: testPassword,
      role: 'organizer',
      twoFactorEnabled: false,
      twoFactorMethod: 'email',
    });

    console.log('Created test attendee, organizer, and admin accounts.\n');

    // =========================================================================
    // SECTION 1: EMAIL OTP BASELINE REGRESSION TESTS (Tests 1 - 12)
    // =========================================================================
    console.log('--- TEST 1: Login with 2FA Disabled ---');
    const loginDisabledRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
    });

    assert(loginDisabledRes.status === 200, 'Login returns HTTP 200');
    assert(loginDisabledRes.data.success === true, 'Response success is true');
    assert(Boolean(loginDisabledRes.data.token), 'Full JWT token is returned');
    assert(!loginDisabledRes.data.require2FA, 'require2FA is false or absent');
    assert(loginDisabledRes.data.user?.role === 'attendee', 'Attendee role is returned in user object');
    const attendeeAuthToken = loginDisabledRes.data.token;
    console.log('');

    console.log('--- TEST 2: Toggle Email 2FA Settings Security ---');
    const rejectBadPassRes = await apiRequest('/api/users/2fa-toggle', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${attendeeAuthToken}` },
      body: JSON.stringify({ enabled: true, currentPassword: 'WrongPassword999' }),
    });
    assert(rejectBadPassRes.status === 401, 'Reject 2FA toggle with incorrect current password (401)');

    const enableEmail2FARes = await apiRequest('/api/users/2fa-toggle', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${attendeeAuthToken}` },
      body: JSON.stringify({ enabled: true, method: 'email', currentPassword: testPassword }),
    });
    assert(enableEmail2FARes.status === 200, 'Enable Email 2FA with valid current password (200)');
    assert(enableEmail2FARes.data.twoFactorEnabled === true, 'Response confirms twoFactorEnabled: true');
    assert(enableEmail2FARes.data.twoFactorMethod === 'email', 'Response confirms twoFactorMethod: email');
    console.log('');

    console.log('--- TEST 3: Login with Email 2FA Enabled (Challenge Issuance) ---');
    const emailLoginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
    });

    assert(emailLoginRes.status === 200, 'Login challenge returns HTTP 200');
    assert(emailLoginRes.data.require2FA === true, 'Response contains require2FA: true');
    assert(emailLoginRes.data.twoFactorMethod === 'email', 'Challenge method is email');
    assert(Boolean(emailLoginRes.data.tempToken), 'Restricted tempToken is returned');
    assert(!emailLoginRes.data.token, 'NO full session JWT is returned');
    assert(sentEmails.length > 0, 'Verification email was dispatched');
    const emailOtp = getLatestSentOtp();
    assert(Boolean(emailOtp && emailOtp.length === 6), 'Dispatched email contains 6-digit OTP');
    console.log('');

    console.log('--- TEST 4: Restricted Pre-Auth Token Guarding ---');
    const blockedProfileRes = await apiRequest('/api/users/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${emailLoginRes.data.tempToken}` },
    });
    assert(blockedProfileRes.status === 401, 'tempToken is REJECTED by /api/users/profile (401)');

    const blockedAdminRes = await apiRequest('/api/admin/metrics', {
      method: 'GET',
      headers: { Authorization: `Bearer ${emailLoginRes.data.tempToken}` },
    });
    assert(blockedAdminRes.status === 401, 'tempToken is REJECTED by admin routes (401)');
    console.log('');

    console.log('--- TEST 5: Invalid OTP Rejection ---');
    const invalidOtpRes = await apiRequest('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken: emailLoginRes.data.tempToken, otp: '000000' }),
    });
    assert(invalidOtpRes.status === 400, 'Invalid OTP is rejected (400)');
    console.log('');

    console.log('--- TEST 6: Resend Cooldown Enforcement ---');
    const immediateResendRes = await apiRequest('/api/auth/resend-2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken: emailLoginRes.data.tempToken }),
    });
    assert(immediateResendRes.status === 429, 'Immediate resend rejected by cooldown (429)');
    console.log('');

    console.log('--- TEST 7: Successful Email OTP Verification & Session Issuance ---');
    const verifyEmailRes = await apiRequest('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken: emailLoginRes.data.tempToken, otp: emailOtp }),
    });
    assert(verifyEmailRes.status === 200, 'Valid OTP verification returns HTTP 200');
    assert(Boolean(verifyEmailRes.data.token), 'Full authenticated JWT token is issued');
    assert(verifyEmailRes.data.user?.role === 'attendee', 'User attendee role returned');

    const verifyReplayRes = await apiRequest('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken: emailLoginRes.data.tempToken, otp: emailOtp }),
    });
    assert(verifyReplayRes.status === 400, 'Replay of consumed email OTP is rejected (400)');
    console.log('');

    // =========================================================================
    // SECTION 2: GOOGLE AUTHENTICATOR (TOTP) ENROLLMENT & STORAGE (Tests 8 - 14)
    // =========================================================================
    console.log('--- TEST 8: TOTP Enrollment Endpoint Authorization ---');
    const unauthSetupRes = await apiRequest('/api/users/2fa/authenticator/setup', {
      method: 'POST',
    });
    assert(unauthSetupRes.status === 401, 'Unauthenticated user cannot start enrollment (401)');

    const authSetupRes = await apiRequest('/api/users/2fa/authenticator/setup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${verifyEmailRes.data.token}` },
    });
    assert(authSetupRes.status === 200, 'Authenticated user can start enrollment (200)');
    assert(authSetupRes.data.qrCode?.startsWith('data:image/png;base64,'), 'QR code Data URL generated');
    assert(Boolean(authSetupRes.data.manualEntryKey), 'Manual Base32 secret key returned');
    const plainSecret = authSetupRes.data.manualEntryKey;
    console.log('');

    console.log('--- TEST 9: TOTP Secret Encrypted at Rest in MongoDB ---');
    const dbUserAfterSetup = await User.findById(attendeeUser._id).select('+totpPendingSecret +totpSecret');
    assert(Boolean(dbUserAfterSetup.totpPendingSecret), 'Pending secret saved in MongoDB');
    assert(dbUserAfterSetup.totpPendingSecret.includes(':'), 'Pending secret has IV:TAG:CIPHERTEXT format');
    assert(!dbUserAfterSetup.totpPendingSecret.includes(plainSecret), 'Plaintext secret is NEVER stored in database');

    const decryptedPending = decryptSecret(dbUserAfterSetup.totpPendingSecret);
    assert(decryptedPending === plainSecret, 'AES-256-GCM successfully decrypts stored pending secret');
    console.log('');

    console.log('--- TEST 10: Secret Never Returned via Standard Profile APIs ---');
    const profileRes = await apiRequest('/api/users/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${verifyEmailRes.data.token}` },
    });
    assert(profileRes.status === 200, 'Profile fetch succeeds (200)');
    assert(!profileRes.data.user?.totpSecret, 'totpSecret is excluded from profile');
    assert(!profileRes.data.user?.totpPendingSecret, 'totpPendingSecret is excluded from profile');
    assert(!profileRes.data.user?.recoveryCodes, 'recoveryCodes are excluded from profile');
    console.log('');

    console.log('--- TEST 11: Invalid First Code Rejection ---');
    const invalidVerifySetupRes = await apiRequest('/api/users/2fa/authenticator/verify-setup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${verifyEmailRes.data.token}` },
      body: JSON.stringify({ code: '999999', currentPassword: testPassword }),
    });
    assert(invalidVerifySetupRes.status === 400, 'Invalid first code rejected (400)');
    const dbUserStillPending = await User.findById(attendeeUser._id);
    assert(dbUserStillPending.totpEnrolled === false, 'totpEnrolled remains false after invalid code');
    console.log('');

    console.log('--- TEST 12: Valid First Code Activates TOTP & Issues Recovery Codes ---');
    const validFirstCode = generateSync({ secret: plainSecret });
    const validVerifySetupRes = await apiRequest('/api/users/2fa/authenticator/verify-setup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${verifyEmailRes.data.token}` },
      body: JSON.stringify({ code: validFirstCode, currentPassword: testPassword }),
    });

    assert(validVerifySetupRes.status === 200, 'Valid code completes enrollment (200)');
    assert(validVerifySetupRes.data.twoFactorEnabled === true, 'twoFactorEnabled is true');
    assert(validVerifySetupRes.data.twoFactorMethod === 'authenticator', 'Method updated to authenticator');
    assert(Array.isArray(validVerifySetupRes.data.recoveryCodes), 'Recovery codes array returned');
    assert(validVerifySetupRes.data.recoveryCodes.length === 8, 'Exactly 8 recovery codes issued');
    const attendeeRecoveryCodes = validVerifySetupRes.data.recoveryCodes;
    console.log('');

    console.log('--- TEST 13: Recovery Codes Stored Only as Hashes in Database ---');
    const dbUserWithRecovery = await User.findById(attendeeUser._id).select('+recoveryCodes +totpSecret');
    assert(Boolean(dbUserWithRecovery.totpSecret), 'totpSecret now active in database');
    assert(dbUserWithRecovery.recoveryCodes.length === 8, '8 recovery records in database');
    assert(Boolean(dbUserWithRecovery.recoveryCodes[0].codeHash), 'Recovery code stored with codeHash');
    assert(!attendeeRecoveryCodes.includes(dbUserWithRecovery.recoveryCodes[0].codeHash), 'Plaintext recovery code NOT stored in DB');
    console.log('');

    console.log('--- TEST 14: Audit Log Event Recorded ---');
    const enrollAudit = await AuditLog.findOne({
      $or: [
        { adminId: attendeeUser._id },
        { targetId: String(attendeeUser._id) },
      ],
      action: '2fa_totp_enrolled',
    });
    assert(Boolean(enrollAudit), 'AuditLog contains 2fa_totp_enrolled record');
    console.log('');

    // =========================================================================
    // SECTION 3: GOOGLE AUTHENTICATOR LOGIN & REPLAY PROTECTION (Tests 15 - 19)
    // =========================================================================
    console.log('--- TEST 15: Login with Authenticator 2FA Enabled ---');
    const preEmailCount = sentEmails.length;
    const totpLoginChallengeRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
    });

    assert(totpLoginChallengeRes.status === 200, 'Login returns 200 challenge');
    assert(totpLoginChallengeRes.data.require2FA === true, 'require2FA is true');
    assert(totpLoginChallengeRes.data.twoFactorMethod === 'authenticator', 'twoFactorMethod is authenticator');
    assert(sentEmails.length === preEmailCount, 'ZERO emails dispatched for TOTP login');
    const totpTempToken = totpLoginChallengeRes.data.tempToken;
    console.log('');

    console.log('--- TEST 16: Invalid TOTP Code Rejection ---');
    const badTotpRes = await apiRequest('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken: totpTempToken, code: '111222' }),
    });
    assert(badTotpRes.status === 400, 'Invalid TOTP code rejected (400)');
    console.log('');

    console.log('--- TEST 17: Valid TOTP Verification & Session Creation ---');
    // Generate valid TOTP code using the shared secret
    const validTotpCode = generateSync({ secret: plainSecret });
    const goodTotpRes = await apiRequest('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken: totpTempToken, code: validTotpCode }),
    });

    assert(goodTotpRes.status === 200, 'Valid TOTP verification succeeds (200)');
    assert(Boolean(goodTotpRes.data.token), 'Authenticated session JWT issued');
    assert(goodTotpRes.data.user?.email === testAttendeeEmail, 'User email matches');
    const attendeeTotpSessionToken = goodTotpRes.data.token;
    console.log('');

    console.log('--- TEST 18: Replay Prevention (Same Accepted Time-Step) ---');
    // Try to login again and use the exact same code
    const replayChallengeRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
    });
    const replayVerifyRes = await apiRequest('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken: replayChallengeRes.data.tempToken, code: validTotpCode }),
    });
    assert(replayVerifyRes.status === 400, 'Replay of same TOTP code in same time-step is REJECTED (400)');
    console.log('');

    console.log('--- TEST 19: Resend Code Rejected for Authenticator Accounts ---');
    const rejectResendTotpRes = await apiRequest('/api/auth/resend-2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken: replayChallengeRes.data.tempToken }),
    });
    assert(rejectResendTotpRes.status === 400, 'Resend request rejected for authenticator accounts (400)');
    assert(rejectResendTotpRes.data.message?.includes('local'), 'Informs user that authenticator codes are generated locally');
    console.log('');

    // =========================================================================
    // SECTION 4: EMERGENCY RECOVERY CODES (Tests 20 - 24)
    // =========================================================================
    console.log('--- TEST 20: Login Using Emergency Recovery Code ---');
    const recoveryChallengeRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
    });

    const firstRecoveryCode = attendeeRecoveryCodes[0];
    const recoveryVerifyRes = await apiRequest('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({
        tempToken: recoveryChallengeRes.data.tempToken,
        recoveryCode: firstRecoveryCode,
        isRecoveryCode: true,
      }),
    });

    assert(recoveryVerifyRes.status === 200, 'Recovery code login succeeds (200)');
    assert(Boolean(recoveryVerifyRes.data.token), 'Full authenticated session issued via recovery code');
    console.log('');

    console.log('--- TEST 21: Single-Use Recovery Code (Replay Rejected) ---');
    const reuseChallengeRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
    });

    const reuseVerifyRes = await apiRequest('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({
        tempToken: reuseChallengeRes.data.tempToken,
        recoveryCode: firstRecoveryCode,
        isRecoveryCode: true,
      }),
    });
    assert(reuseVerifyRes.status === 400, 'Consumed recovery code CANNOT be reused (400)');

    const dbUserAfterRecovery = await User.findById(attendeeUser._id).select('+recoveryCodes');
    const usedRecord = dbUserAfterRecovery.recoveryCodes.find((r) => r.used === true);
    assert(Boolean(usedRecord), 'Database reflects recovery code used: true');
    console.log('');

    console.log('--- TEST 22: Regenerate Recovery Codes Invalidate Prior Codes ---');
    const regenCodesRes = await apiRequest('/api/users/2fa/authenticator/recovery-codes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${attendeeTotpSessionToken}` },
      body: JSON.stringify({ currentPassword: testPassword }),
    });
    assert(regenCodesRes.status === 200, 'Regenerate recovery codes returns HTTP 200');
    assert(regenCodesRes.data.recoveryCodes.length === 8, '8 new recovery codes returned');

    // Attempt to use remaining old code #2
    const oldCode2 = attendeeRecoveryCodes[1];
    const oldCodeChallengeRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
    });
    const oldCodeVerifyRes = await apiRequest('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({
        tempToken: oldCodeChallengeRes.data.tempToken,
        recoveryCode: oldCode2,
        isRecoveryCode: true,
      }),
    });
    assert(oldCodeVerifyRes.status === 400, 'Old recovery code invalidated upon regeneration (400)');
    console.log('');

    // =========================================================================
    // SECTION 5: MANDATORY ADMIN 2FA & ENROLLMENT (Tests 23 - 28)
    // =========================================================================
    console.log('--- TEST 23: Admin Login with Mandatory 2FA & Zero Email Dependency ---');
    const preAdminEmailCount = sentEmails.length;
    const adminLoginRes = await apiRequest('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: testAdminEmail, password: testPassword }),
    });

    assert(adminLoginRes.status === 200, 'Admin login returns HTTP 200');
    assert(adminLoginRes.data.require2FA === true, 'Admin login requires 2FA');
    assert(adminLoginRes.data.twoFactorMethod === 'authenticator', 'Admin 2FA method is strictly authenticator');
    assert(adminLoginRes.data.requireSetup === true, 'Unenrolled admin receives requireSetup: true');
    assert(sentEmails.length === preAdminEmailCount, 'ZERO emails dispatched for admin login');
    const adminTempToken = adminLoginRes.data.tempToken;
    console.log('');

    console.log('--- TEST 24: Unenrolled Admin Setup via Pre-Auth Token ---');
    const adminSetupRes = await apiRequest('/api/users/2fa/authenticator/setup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminTempToken}` },
    });
    assert(adminSetupRes.status === 200, 'Admin can request setup with pre-auth tempToken (200)');
    assert(Boolean(adminSetupRes.data.manualEntryKey), 'Admin setup returns manual secret');
    assert(Boolean(adminSetupRes.data.qrCode), 'Admin setup returns QR code Data URL');
    const adminPlainSecret = adminSetupRes.data.manualEntryKey;
    console.log('');

    console.log('--- TEST 25: Admin Verify Setup & Immediate Session Grant ---');
    const adminFirstCode = generateSync({ secret: adminPlainSecret });
    const adminVerifySetupRes = await apiRequest('/api/users/2fa/authenticator/verify-setup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminTempToken}` },
      body: JSON.stringify({ code: adminFirstCode, tempToken: adminTempToken }),
    });

    assert(adminVerifySetupRes.status === 200, 'Admin setup verification returns HTTP 200');
    assert(adminVerifySetupRes.data.user?.role === 'admin', 'Returned user role is admin');
    assert(Array.isArray(adminVerifySetupRes.data.recoveryCodes), 'Admin emergency recovery codes issued');
    console.log('');

    console.log('--- TEST 26: Enrolled Admin Login with TOTP ---');
    const enrolledAdminLoginRes = await apiRequest('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: testAdminEmail, password: testPassword }),
    });

    assert(enrolledAdminLoginRes.status === 200, 'Enrolled admin login returns 200 challenge');
    assert(!enrolledAdminLoginRes.data.requireSetup, 'Enrolled admin does NOT require setup');

    const adminTotpCode = generateSync({ secret: adminPlainSecret });
    const enrolledAdminVerifyRes = await apiRequest('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken: enrolledAdminLoginRes.data.tempToken, code: adminTotpCode }),
    });

    assert(enrolledAdminVerifyRes.status === 200, 'Admin TOTP verification succeeds (200)');
    assert(enrolledAdminVerifyRes.data.user?.role === 'admin', 'Admin user object returned');
    assert(Boolean(enrolledAdminVerifyRes.data.token), 'Admin full JWT issued');
    const adminFullToken = enrolledAdminVerifyRes.data.token;
    console.log('');

    console.log('--- TEST 27: Admin Forbidden from Disabling Mandatory 2FA ---');
    const adminDisableAttemptRes = await apiRequest('/api/users/2fa/authenticator/disable', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminFullToken}` },
      body: JSON.stringify({ currentPassword: testPassword }),
    });
    assert(adminDisableAttemptRes.status === 403, 'Admin disable request rejected with 403 Forbidden');
    assert(adminDisableAttemptRes.data.message?.includes('policy'), 'Security policy message returned');
    console.log('');

    console.log('--- TEST 28: Attendee Forbidden from Admin Login Route ---');
    const attendeeOnAdminLoginRes = await apiRequest('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: testAttendeeEmail, password: testPassword }),
    });
    assert(attendeeOnAdminLoginRes.status === 403, 'Attendee credentials rejected on admin-login route (403)');
    console.log('');

    // =========================================================================
    // SECTION 6: ORGANIZER FLOW & METHOD SWITCHING (Tests 29 - 31)
    // =========================================================================
    console.log('--- TEST 29: Organizer Authenticator Enrollment & Login ---');
    const orgLoginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testOrganizerEmail, password: testPassword }),
    });
    const orgToken = orgLoginRes.data.token;

    const orgSetupRes = await apiRequest('/api/users/2fa/authenticator/setup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${orgToken}` },
    });
    const orgSecret = orgSetupRes.data.manualEntryKey;
    const orgFirstCode = generateSync({ secret: orgSecret });

    const orgVerifySetupRes = await apiRequest('/api/users/2fa/authenticator/verify-setup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${orgToken}` },
      body: JSON.stringify({ code: orgFirstCode, currentPassword: testPassword }),
    });
    assert(orgVerifySetupRes.status === 200, 'Organizer successfully enrolled in TOTP (200)');

    const orgTotpLoginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testOrganizerEmail, password: testPassword }),
    });
    assert(orgTotpLoginRes.data.twoFactorMethod === 'authenticator', 'Organizer login challenges with authenticator');
    console.log('');

    console.log('--- TEST 30: Switch from Authenticator to Email OTP ---');
    const orgTotpCode = generateSync({ secret: orgSecret });
    const orgVerifyLoginRes = await apiRequest('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken: orgTotpLoginRes.data.tempToken, code: orgTotpCode }),
    });
    const activeOrgToken = orgVerifyLoginRes.data.token;

    const switchEmailRes = await apiRequest('/api/users/2fa-toggle', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${activeOrgToken}` },
      body: JSON.stringify({ enabled: true, method: 'email', currentPassword: testPassword }),
    });
    assert(switchEmailRes.status === 200, 'Switch to Email OTP succeeds (200)');
    assert(switchEmailRes.data.twoFactorMethod === 'email', 'twoFactorMethod confirmed email');
    console.log('');

    console.log('--- TEST 31: Disable 2FA for Non-Admin Account ---');
    const disableOrgRes = await apiRequest('/api/users/2fa-toggle', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${activeOrgToken}` },
      body: JSON.stringify({ enabled: false, currentPassword: testPassword }),
    });
    assert(disableOrgRes.status === 200, 'Disable 2FA succeeds for organizer (200)');
    assert(disableOrgRes.data.twoFactorEnabled === false, 'twoFactorEnabled confirmed false');
    console.log('');

  } catch (err) {
    console.error('💥 Test suite crashed with error:', err);
    failed++;
  } finally {
    console.log('--- CLEANUP: Removing Test Users & Logs ---');
    try {
      if (attendeeUser?._id) await User.findByIdAndDelete(attendeeUser._id);
      if (adminUser?._id) await User.findByIdAndDelete(adminUser._id);
      if (organizerUser?._id) await User.findByIdAndDelete(organizerUser._id);
      await AuditLog.deleteMany({ userId: { $in: [attendeeUser?._id, adminUser?._id, organizerUser?._id] } });
      console.log('Test users and audit records removed.');
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr.message);
    }

    if (server) {
      server.close();
    }
    await mongoose.disconnect();
    console.log('Database disconnected.\n');

    console.log('===============================================================');
    console.log(`📊 COMPREHENSIVE 2FA TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

run2FATests();
