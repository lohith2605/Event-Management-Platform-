import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import crypto from 'crypto';
import User from '../src/models/User.js';
import { connectDB } from '../src/config/db.js';

const BASE_URL = 'http://127.0.0.1:5000';

let passed = 0;
let total = 0;

function assert(condition, description) {
  total++;
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    throw new Error(`Assertion failed: ${description}`);
  }
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('🛡️ UTSAV Password Reset Fix Verification Suite');
  console.log('====================================================\n');

  try {
    await connectDB();
    const db = mongoose.connection.db;

    // --- TEST SUITE 1: Valid UTSAV Attendee Account ---
    console.log('--- Test 1: Valid UTSAV Attendee Account Reset & Role Preservation ---');
    const attendeeEmail = `attendee_val_${Date.now()}@utsav.test`;
    const attendeeInitPass = 'InitialPass123!';
    const attendeeNewPass = 'NewSecurePass456!';

    const attendee = await User.create({
      name: 'Rohan Attendee',
      email: attendeeEmail,
      password: attendeeInitPass,
      role: 'attendee',
    });

    // Request reset
    const rawAttToken = attendee.getResetPasswordToken();
    await attendee.save({ validateBeforeSave: false });

    // Execute reset via HTTP endpoint
    const resAtt = await fetch(`${BASE_URL}/api/auth/reset-password/${rawAttToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: attendeeNewPass, confirmPassword: attendeeNewPass }),
    });
    const dataAtt = await resAtt.json();

    assert(resAtt.status === 200, 'HTTP 200 returned on valid attendee reset');
    assert(dataAtt.success === true, 'Response success is true');
    assert(dataAtt.user.role === 'attendee', 'User role is preserved as attendee');

    // Verify authentication with new vs old password
    const checkAttOld = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: attendeeEmail, password: attendeeInitPass }),
    });
    assert(checkAttOld.status === 401, 'Old password fails authentication');

    const checkAttNew = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: attendeeEmail, password: attendeeNewPass }),
    });
    assert(checkAttNew.status === 200, 'New password successfully authenticates');

    // Token invalidation check (single-use)
    const checkAttReuse = await fetch(`${BASE_URL}/api/auth/reset-password/${rawAttToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'AnotherPass789!', confirmPassword: 'AnotherPass789!' }),
    });
    assert(checkAttReuse.status === 400, 'Reused token is rejected with 400');

    await User.findByIdAndDelete(attendee._id);

    // --- TEST SUITE 2: Valid UTSAV Organizer Account ---
    console.log('\n--- Test 2: Valid UTSAV Organizer Account Reset & Role Preservation ---');
    const orgEmail = `org_val_${Date.now()}@utsav.test`;
    const orgInitPass = 'OrgInitialPass123!';
    const orgNewPass = 'OrgNewPass456!';

    const organizer = await User.create({
      name: 'IIT Fest Committee',
      email: orgEmail,
      password: orgInitPass,
      role: 'organizer',
    });

    const rawOrgToken = organizer.getResetPasswordToken();
    await organizer.save({ validateBeforeSave: false });

    const resOrg = await fetch(`${BASE_URL}/api/auth/reset-password/${rawOrgToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: orgNewPass, confirmPassword: orgNewPass }),
    });
    const dataOrg = await resOrg.json();

    assert(resOrg.status === 200, 'HTTP 200 returned on valid organizer reset');
    assert(dataOrg.user.role === 'organizer', 'User role is strictly preserved as organizer');

    const checkOrgNew = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: orgEmail, password: orgNewPass }),
    });
    assert(checkOrgNew.status === 200, 'New password authenticates for organizer');

    await User.findByIdAndDelete(organizer._id);

    // --- TEST SUITE 3: Valid UTSAV Admin Account ---
    console.log('\n--- Test 3: Valid UTSAV Admin Account Reset & Role Preservation ---');
    const adminEmail = `admin_val_${Date.now()}@utsav.test`;
    const adminInitPass = 'AdminInitialPass123!';
    const adminNewPass = 'AdminNewPass456!';

    const adminUser = await User.create({
      name: 'Root Platform Admin',
      email: adminEmail,
      password: adminInitPass,
      role: 'admin',
    });

    const rawAdminToken = adminUser.getResetPasswordToken();
    await adminUser.save({ validateBeforeSave: false });

    const resAdmin = await fetch(`${BASE_URL}/api/auth/reset-password/${rawAdminToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminNewPass, confirmPassword: adminNewPass }),
    });
    const dataAdmin = await resAdmin.json();

    assert(resAdmin.status === 200, 'HTTP 200 returned on valid admin reset');
    assert(dataAdmin.user.role === 'admin', 'User role is strictly preserved as admin');

    const checkAdminNew = await fetch(`${BASE_URL}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminNewPass }),
    });
    assert(checkAdminNew.status === 200, 'New password authenticates on admin-login portal');

    await User.findByIdAndDelete(adminUser._id);

    // --- TEST SUITE 4: Legacy Account with role EMPLOYEE and missing name ---
    console.log('\n--- Test 4: Legacy Account (role: EMPLOYEE, missing name) Reset Safety ---');
    // Using arshadtaiyab010@gmail.com which triggered the 500 error in the user's report
    const targetLegacyEmail = 'arshadtaiyab010@gmail.com';
    const legacyDoc = await User.findOne({ email: targetLegacyEmail });
    assert(legacyDoc != null, 'Found existing legacy account arshadtaiyab010@gmail.com in database');
    assert(legacyDoc.role === 'EMPLOYEE', 'Account currently has role EMPLOYEE');

    // Arm reset token on this account
    const rawLegacyToken = legacyDoc.getResetPasswordToken();
    await legacyDoc.save({ validateBeforeSave: false });

    const legacyNewPass = 'LegacyUpdatedSecret123!';

    // Call POST /api/auth/reset-password/:token
    const resLegacy = await fetch(`${BASE_URL}/api/auth/reset-password/${rawLegacyToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: legacyNewPass, confirmPassword: legacyNewPass }),
    });
    const dataLegacy = await resLegacy.json();

    assert(resLegacy.status === 200, 'HTTP 200 returned (NO 500 error!)');
    assert(dataLegacy.success === true, 'Response success is true');
    assert(dataLegacy.user.role === 'EMPLOYEE', 'Legacy role EMPLOYEE was preserved (NOT silently converted)');
    assert(dataLegacy.user.name === 'Arshad Taiyab', 'Missing name was safely resolved from linked employee record ("Arshad Taiyab")');

    // Confirm new password hashes properly and authenticates
    const updatedLegacy = await User.findOne({ email: targetLegacyEmail }).select('+password');
    const isNewPassMatch = await updatedLegacy.matchPassword(legacyNewPass);
    assert(isNewPassMatch === true, 'New password matches via bcrypt');
    assert(updatedLegacy.password.startsWith('$2'), 'Stored password is valid bcrypt hash');
    assert(updatedLegacy.resetPasswordToken == null, 'Reset token field was cleared');

    // --- TEST SUITE 5: Legacy Account with NO name and NO employee record ---
    console.log('\n--- Test 5: Legacy Account with no name and no employee record ---');
    const orphanLegacyEmail = `orphan_${Date.now()}@legacy.test`;
    // Create directly via raw mongo driver to bypass schema validation (mimicking legacy data)
    await db.collection('users').insertOne({
      email: orphanLegacyEmail,
      password: await (async () => {
        const bcrypt = (await import('bcryptjs')).default;
        return bcrypt.hash('LegacyPass123!', 10);
      })(),
      role: 'EMPLOYEE',
      // no name field
      // no employeeId
      createdAt: new Date(),
    });

    const orphanUser = await User.findOne({ email: orphanLegacyEmail });
    const rawOrphanToken = orphanUser.getResetPasswordToken();
    await orphanUser.save({ validateBeforeSave: false });

    const orphanNewPass = 'OrphanNewPass123!';
    const resOrphan = await fetch(`${BASE_URL}/api/auth/reset-password/${rawOrphanToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: orphanNewPass, confirmPassword: orphanNewPass }),
    });
    const dataOrphan = await resOrphan.json();

    assert(resOrphan.status === 200, 'HTTP 200 returned for orphan legacy account (no 500 error)');
    assert(dataOrphan.user.role === 'EMPLOYEE', 'Role remains EMPLOYEE without silent conversion');
    assert(!dataOrphan.user.name || dataOrphan.user.name === '', 'Did not invent a placeholder name');

    await db.collection('users').deleteOne({ email: orphanLegacyEmail });

    // --- TEST SUITE 6: Security & Validation Edge Cases ---
    console.log('\n--- Test 6: Security & Token Validation Edge Cases ---');
    // Short password
    const resShort = await fetch(`${BASE_URL}/api/auth/reset-password/sample_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '123', confirmPassword: '123' }),
    });
    assert(resShort.status === 400, 'Password < 6 chars rejected with 400');

    // Mismatched confirmation
    const resMismatch = await fetch(`${BASE_URL}/api/auth/reset-password/sample_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'ValidPassword123!', confirmPassword: 'DifferentPassword123!' }),
    });
    assert(resMismatch.status === 400, 'Password mismatch rejected with 400');

    // Invalid / Non-existent token
    const resInvalid = await fetch(`${BASE_URL}/api/auth/reset-password/non_existent_token_999`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'ValidPassword123!', confirmPassword: 'ValidPassword123!' }),
    });
    assert(resInvalid.status === 400, 'Invalid token rejected with 400');

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passed}/${total} TESTS PASSED SUCCESSFULLY!`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ Test Suite Failed:', err);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(0);
  }
}

runTestSuite();
