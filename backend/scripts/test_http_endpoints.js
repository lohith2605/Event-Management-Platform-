import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../src/models/User.js';
import { connectDB } from '../src/config/db.js';

const BASE_URL = 'http://127.0.0.1:5000';

async function runHttpTests() {
  console.log('====================================================');
  console.log('🌐 UTSAV HTTP Endpoint Integration Tests');
  console.log('====================================================\n');

  try {
    await connectDB();

    const uniqueId = Date.now();
    const testEmail = `http_test_${uniqueId}@example.com`;
    const initialPassword = 'InitialPass123!';
    const updatedPassword = 'UpdatedPass456!';

    // 1. Create a real user in the DB
    const user = await User.create({
      name: 'HTTP Test Attendee',
      email: testEmail,
      password: initialPassword,
      role: 'attendee',
    });

    console.log('Created test user in database:', testEmail);

    // Test A: Unknown email returns identical generic 200
    console.log('\n--- Test A: Enumeration Resistance (Unknown Email) ---');
    const resUnknown = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nonexistent_${uniqueId}@example.com` }),
    });
    const dataUnknown = await resUnknown.json();
    console.log('Status code:', resUnknown.status);
    console.log('Response body:', dataUnknown);
    if (resUnknown.status !== 200 || !dataUnknown.message.includes('If an account exists')) {
      throw new Error('Unknown email enumeration test failed!');
    }
    console.log('✅ PASS: Unknown email returned safe 200 with generic notification.');

    // Test B: Registered user email returns identical response
    console.log('\n--- Test B: Registered User Forgot Password Request ---');
    const resKnown = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const dataKnown = await resKnown.json();
    console.log('Status code:', resKnown.status);
    console.log('Response body:', dataKnown);
    if (resKnown.status !== 200 || dataKnown.message !== dataUnknown.message) {
      throw new Error('Registered email response mismatch!');
    }
    console.log('✅ PASS: Registered email returned identical generic response (zero enumeration leakage).');

    // Test C: Check user document for hashed token and retrieve generated token for reset
    console.log('\n--- Test C: Database Token Storage Check ---');
    const userWithToken = await User.findById(user._id).select('+resetPasswordToken +resetPasswordExpire');
    console.log('Hashed token in DB:', userWithToken.resetPasswordToken);
    console.log('Expires at:', userWithToken.resetPasswordExpire);
    if (!userWithToken.resetPasswordToken || !userWithToken.resetPasswordExpire) {
      throw new Error('Token fields not set on user after forgot-password request!');
    }
    console.log('✅ PASS: Hashed token and expiration saved in database.');

    // Test D: Invalid token reset attempt
    console.log('\n--- Test D: Reset with Malicious/Invalid Token ---');
    const resInvalid = await fetch(`${BASE_URL}/api/auth/reset-password/totally_invalid_token_123456`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: updatedPassword, confirmPassword: updatedPassword }),
    });
    const dataInvalid = await resInvalid.json();
    console.log('Status code:', resInvalid.status);
    console.log('Response body:', dataInvalid);
    if (resInvalid.status !== 400) {
      throw new Error('Invalid token was not rejected with 400!');
    }
    console.log('✅ PASS: Invalid token correctly rejected with 400 Bad Request.');

    // Test E: Password mismatch attempt
    console.log('\n--- Test E: Reset with Mismatched Passwords ---');
    // Generate a fresh known raw token directly on user so we can test the reset endpoint
    const rawResetToken = userWithToken.getResetPasswordToken();
    await userWithToken.save();

    const resMismatch = await fetch(`${BASE_URL}/api/auth/reset-password/${rawResetToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: updatedPassword, confirmPassword: 'DifferentPassword123!' }),
    });
    const dataMismatch = await resMismatch.json();
    console.log('Status code:', resMismatch.status);
    console.log('Response body:', dataMismatch);
    if (resMismatch.status !== 400) {
      throw new Error('Password mismatch was not rejected with 400!');
    }
    console.log('✅ PASS: Password mismatch rejected with 400 Bad Request.');

    // Test F: Valid password reset via HTTP endpoint
    console.log('\n--- Test F: Valid Password Reset via HTTP ---');
    const resResetSuccess = await fetch(`${BASE_URL}/api/auth/reset-password/${rawResetToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: updatedPassword, confirmPassword: updatedPassword }),
    });
    const dataResetSuccess = await resResetSuccess.json();
    console.log('Status code:', resResetSuccess.status);
    console.log('Response body:', dataResetSuccess);
    if (resResetSuccess.status !== 200 || !dataResetSuccess.user) {
      throw new Error('Valid password reset failed!');
    }
    console.log('✅ PASS: Password successfully reset and authenticated token returned.');

    // Test G: Attempting to reuse the exact same token
    console.log('\n--- Test G: Reusing Single-Use Token ---');
    const resReuse = await fetch(`${BASE_URL}/api/auth/reset-password/${rawResetToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'AnotherPassword789!', confirmPassword: 'AnotherPassword789!' }),
    });
    const dataReuse = await resReuse.json();
    console.log('Status code:', resReuse.status);
    console.log('Response body:', dataReuse);
    if (resReuse.status !== 400) {
      throw new Error('Reused token was not rejected with 400!');
    }
    console.log('✅ PASS: Previously used token is completely rejected.');

    // Test H: Login with new password vs old password
    console.log('\n--- Test H: Login with New vs Old Password ---');
    const resOldLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: initialPassword }),
    });
    console.log('Old password login status:', resOldLogin.status);
    if (resOldLogin.status === 200) {
      throw new Error('Old password was incorrectly accepted!');
    }

    const resNewLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: updatedPassword }),
    });
    const dataNewLogin = await resNewLogin.json();
    console.log('New password login status:', resNewLogin.status);
    console.log('Logged in user:', dataNewLogin.user);
    if (resNewLogin.status !== 200 || dataNewLogin.user.email !== testEmail || dataNewLogin.user.role !== 'attendee') {
      throw new Error('New password login failed or user properties altered!');
    }
    console.log('✅ PASS: Old password rejected, new password authenticated, attendee role preserved.');

    // Cleanup
    await User.findByIdAndDelete(user._id);
    console.log('\nCleaned up test user.');

    console.log('\n====================================================');
    console.log('🎉 ALL HTTP INTEGRATION TESTS COMPLETED SUCCESSFULLY!');
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ HTTP Integration Tests Failed:', error.message);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(0);
  }
}

runHttpTests();
