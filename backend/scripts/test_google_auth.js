import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import crypto from 'crypto';
import User from '../src/models/User.js';
import { connectDB } from '../src/config/db.js';
import { googleAuth } from '../src/controllers/authController.js';
import { initializeFirebaseAdmin } from '../src/config/firebaseAdmin.js';
import * as firebaseAuth from 'firebase-admin/auth';

const BASE_URL = 'http://localhost:5000';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Mock response object for controller unit/integration testing
 */
function createMockRes() {
  const res = {
    statusCode: null,
    cookies: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    cookie(name, val, opts) {
      this.cookies[name] = { val, opts };
      return this;
    },
  };
  return res;
}

async function runGoogleAuthTests() {
  console.log('====================================================');
  console.log('🚀 UTSAV Phase 2: Google Authentication Test Suite');
  console.log('====================================================\n');

  try {
    await connectDB();
    console.log('Connected to MongoDB.\n');

    // ----------------------------------------------------
    // Section 1: HTTP Endpoint Live Validation
    // ----------------------------------------------------
    console.log('--- Section 1: Live HTTP Endpoint Validation (/api/auth/google) ---');

    // 1.1 Missing token
    const resEmpty = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const dataEmpty = await resEmpty.json();
    assert(resEmpty.status === 400, 'Empty body returns HTTP 400');
    assert(
      dataEmpty.message === 'A valid Google ID token is required.',
      'Returns expected error message for missing token'
    );

    // 1.2 Invalid token type
    const resBadType = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 12345 }),
    });
    assert(resBadType.status === 400, 'Non-string token returns HTTP 400');

    // 1.3 Invalid/Malformed ID token
    const resMalformed = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'invalid.malformed.idtoken' }),
    });
    const dataMalformed = await resMalformed.json();
    assert(resMalformed.status === 401, 'Malformed token returns HTTP 401');
    assert(
      dataMalformed.message.includes('Google identity verification failed'),
      'Returns identity verification failure message'
    );

    // ----------------------------------------------------
    // Section 2: Mocked Token Verification & Controller Logic
    // ----------------------------------------------------
    console.log('\n--- Section 2: Google Authentication Lifecycle & Role Integrity ---');

    // Initialize Firebase Admin and stub verifyIdToken on the auth instance
    initializeFirebaseAdmin();
    const authInstance = firebaseAuth.getAuth();
    const originalVerifyIdToken = authInstance.verifyIdToken;
    let mockDecodedToken = null;

    authInstance.verifyIdToken = async (token) => {
      if (token === 'valid-mock-token') {
        return mockDecodedToken;
      }
      return originalVerifyIdToken.call(authInstance, token);
    };

    const timestamp = Date.now();

    // 2.1 Unverified Email Rejection
    console.log('\n- Test 2.1: Reject Unverified Google Email');
    mockDecodedToken = {
      uid: `google_uid_unverified_${timestamp}`,
      email: `unverified_${timestamp}@gmail.com`,
      email_verified: false,
      name: 'Unverified User',
    };
    const resUnverified = createMockRes();
    await googleAuth({ body: { idToken: 'valid-mock-token' } }, resUnverified, (err) => {
      if (err) throw err;
    });
    assert(resUnverified.statusCode === 401, 'Unverified email is rejected with HTTP 401');
    assert(
      resUnverified.body.message.includes('not verified'),
      'Clear notice about unverified email returned'
    );

    // 2.2 New User Registration via Google (Strict Attendee Role Default)
    console.log('\n- Test 2.2: New User Self-Registration as Attendee');
    const newGoogleEmail = `new_google_attendee_${timestamp}@gmail.com`;
    const newGoogleUid = `google_uid_${timestamp}`;
    mockDecodedToken = {
      uid: newGoogleUid,
      email: newGoogleEmail,
      email_verified: true,
      name: 'Rohan Sharma',
      picture: 'https://lh3.googleusercontent.com/a/sample_avatar.jpg',
    };
    const resNewUser = createMockRes();
    await googleAuth({ body: { idToken: 'valid-mock-token' } }, resNewUser, (err) => {
      if (err) throw err;
    });

    assert(resNewUser.statusCode === 201, 'New user created with HTTP 201');
    assert(resNewUser.body.user.email === newGoogleEmail, 'User email matches Google email');
    assert(resNewUser.body.user.role === 'attendee', 'New user role is strictly "attendee"');
    assert(resNewUser.body.user.name === 'Rohan Sharma', 'User name taken from Google profile');
    assert(
      resNewUser.cookies.token && resNewUser.cookies.token.val,
      'HTTP-only JWT session cookie dispatched'
    );

    // Verify in MongoDB
    const createdInDb = await User.findOne({ email: newGoogleEmail }).select('+password');
    assert(createdInDb != null, 'User saved in database');
    assert(createdInDb.googleId === newGoogleUid, 'Database user contains googleId');
    assert(createdInDb.role === 'attendee', 'Database role is strictly attendee');
    assert(createdInDb.password && createdInDb.password.length > 20, 'Password is securely hashed');

    // 2.3 Existing Attendee Account Linking
    console.log('\n- Test 2.3: Safe Linking of Existing Attendee Account');
    const existingAttendeeEmail = `existing_attendee_${timestamp}@example.com`;
    await User.create({
      name: 'Pre-existing Attendee',
      email: existingAttendeeEmail,
      password: 'StrongExistingPassword123!',
      role: 'attendee',
    });

    const attendeeGoogleUid = `google_uid_attendee_${timestamp}`;
    mockDecodedToken = {
      uid: attendeeGoogleUid,
      email: existingAttendeeEmail,
      email_verified: true,
      name: 'Pre-existing Attendee Google',
      picture: 'https://lh3.googleusercontent.com/attendee.jpg',
    };
    const resLinkAttendee = createMockRes();
    await googleAuth({ body: { idToken: 'valid-mock-token' } }, resLinkAttendee, (err) => {
      if (err) throw err;
    });

    assert(resLinkAttendee.statusCode === 200, 'Existing user logged in with HTTP 200');
    assert(resLinkAttendee.body.user.role === 'attendee', 'Role remains attendee');
    const updatedAttendee = await User.findOne({ email: existingAttendeeEmail });
    assert(updatedAttendee.googleId === attendeeGoogleUid, 'googleId safely linked to existing user');

    // 2.4 Existing Organizer Account Linking (Role Must Never Be Overwritten)
    console.log('\n- Test 2.4: Preservation of Existing Organizer Role');
    const organizerEmail = `organizer_host_${timestamp}@example.com`;
    await User.create({
      name: 'Campus Event Committee',
      email: organizerEmail,
      password: 'OrganizerPassword123!',
      role: 'organizer',
    });

    const organizerGoogleUid = `google_uid_org_${timestamp}`;
    mockDecodedToken = {
      uid: organizerGoogleUid,
      email: organizerEmail,
      email_verified: true,
      name: 'Organizer Committee Google',
      picture: 'https://lh3.googleusercontent.com/org.jpg',
    };
    const resLinkOrg = createMockRes();
    await googleAuth({ body: { idToken: 'valid-mock-token' } }, resLinkOrg, (err) => {
      if (err) throw err;
    });

    assert(resLinkOrg.statusCode === 200, 'Organizer logged in with HTTP 200');
    assert(resLinkOrg.body.user.role === 'organizer', 'Role STRICTLY preserved as organizer');
    const updatedOrg = await User.findOne({ email: organizerEmail });
    assert(updatedOrg.googleId === organizerGoogleUid, 'googleId linked to organizer');
    assert(updatedOrg.role === 'organizer', 'Database role was not downgraded or altered');

    // 2.5 Existing Admin Account Linking (Admin Role Protected)
    console.log('\n- Test 2.5: Preservation of Existing Admin Role');
    const adminEmail = `admin_officer_${timestamp}@example.com`;
    await User.create({
      name: 'Platform Administrator',
      email: adminEmail,
      password: 'AdminPassword123!',
      role: 'admin',
    });

    const adminGoogleUid = `google_uid_admin_${timestamp}`;
    mockDecodedToken = {
      uid: adminGoogleUid,
      email: adminEmail,
      email_verified: true,
      name: 'Admin Google Account',
    };
    const resLinkAdmin = createMockRes();
    await googleAuth({ body: { idToken: 'valid-mock-token' } }, resLinkAdmin, (err) => {
      if (err) throw err;
    });

    assert(resLinkAdmin.statusCode === 200, 'Admin logged in with HTTP 200');
    assert(resLinkAdmin.body.user.role === 'admin', 'Role STRICTLY preserved as admin');
    const updatedAdmin = await User.findOne({ email: adminEmail });
    assert(updatedAdmin.googleId === adminGoogleUid, 'googleId linked to admin');
    assert(updatedAdmin.role === 'admin', 'Database role was not downgraded or altered');

    // 2.6 Suspended Account Rejection
    console.log('\n- Test 2.6: Enforcement of Account Suspension');
    const suspendedEmail = `suspended_user_${timestamp}@example.com`;
    await User.create({
      name: 'Suspended Member',
      email: suspendedEmail,
      password: 'SuspendedPass123!',
      role: 'attendee',
      isSuspended: true,
      suspensionReason: 'Terms violation: spamming event registrations',
    });

    mockDecodedToken = {
      uid: `google_uid_suspended_${timestamp}`,
      email: suspendedEmail,
      email_verified: true,
      name: 'Suspended Member',
    };
    const resSuspended = createMockRes();
    await googleAuth({ body: { idToken: 'valid-mock-token' } }, resSuspended, (err) => {
      if (err) throw err;
    });

    assert(resSuspended.statusCode === 403, 'Suspended user is rejected with HTTP 403');
    assert(resSuspended.body.isSuspended === true, 'Response flags account suspension');
    assert(
      resSuspended.body.message.includes('suspended'),
      'Suspension notice delivered in response'
    );

    // Clean up mock
    authInstance.verifyIdToken = originalVerifyIdToken;

    // Clean up created test accounts
    await User.deleteMany({
      email: {
        $in: [
          newGoogleEmail,
          existingAttendeeEmail,
          organizerEmail,
          adminEmail,
          suspendedEmail,
        ],
      },
    });

    console.log('\n====================================================');
    console.log(`🎉 ALL TESTS PASSED: ${passedTests} / ${totalTests} assertions verified!`);
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ Test Suite Aborted with Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runGoogleAuthTests();
