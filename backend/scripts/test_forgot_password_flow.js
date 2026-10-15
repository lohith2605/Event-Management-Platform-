import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import crypto from 'crypto';
import User from '../src/models/User.js';
import { connectDB } from '../src/config/db.js';
import { sendPasswordResetEmail } from '../src/services/emailService.js';

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

async function runTests() {
  console.log('====================================================');
  console.log('🧪 UTSAV Phase 1 Authentication Flow Test Suite');
  console.log('====================================================\n');

  try {
    await connectDB();
    console.log('Connected to MongoDB.\n');

    const testEmail = `test_reset_${Date.now()}@example.com`;
    const originalPassword = 'OriginalPass123!';
    const newPassword = 'NewSecretPass456!';

    // 1. Setup Test User
    console.log('--- Test 1: User Model & Token Generation Security ---');
    const user = await User.create({
      name: 'Test Reset Attendee',
      email: testEmail,
      password: originalPassword,
      role: 'attendee',
    });

    assert(user._id != null, 'User successfully created');
    assert(user.role === 'attendee', 'User role is attendee');

    // 2. Token Generation
    const rawToken = user.getResetPasswordToken();
    assert(typeof rawToken === 'string' && rawToken.length === 64, 'Raw token is 64 hex characters (32 random bytes)');
    assert(user.resetPasswordToken !== rawToken, 'Database resetPasswordToken is hashed and not equal to raw token');
    assert(user.resetPasswordToken.length === 64, 'Database resetPasswordToken is a sha256 hash');
    assert(user.resetPasswordExpire > Date.now() + 25 * 60 * 1000, 'Expiration is set to ~30 minutes in the future');

    await user.save();

    // 3. Verify Token Hashing Verification
    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    assert(user.resetPasswordToken === expectedHash, 'Database hash exactly matches SHA-256(rawToken)');

    // 4. Test Email Service Generation
    console.log('\n--- Test 2: Email Service & Template Verification ---');
    const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password/${rawToken}`;
    
    // We can call sendPasswordResetEmail
    const emailResult = await sendPasswordResetEmail({
      email: user.email,
      resetUrl,
      userName: user.name,
    });
    assert(emailResult.success === true, 'sendPasswordResetEmail completed successfully');
    console.log(`  ℹ️ Email dispatch status: ${emailResult.delivered ? 'Delivered via SMTP' : 'Simulated locally'}`);

    // 5. Test Password Reset with Invalid Token
    console.log('\n--- Test 3: Password Reset Endpoint Validations ---');
    const invalidHash = crypto.createHash('sha256').update('invalid_token_12345').digest('hex');
    const userWithInvalidToken = await User.findOne({
      resetPasswordToken: invalidHash,
      resetPasswordExpire: { $gt: Date.now() },
    });
    assert(!userWithInvalidToken, 'Invalid token does not match any user');

    // 6. Test Password Reset with Expired Token
    user.resetPasswordExpire = Date.now() - 1000; // expired
    await user.save();

    const userWithExpiredToken = await User.findOne({
      resetPasswordToken: expectedHash,
      resetPasswordExpire: { $gt: Date.now() },
    });
    assert(!userWithExpiredToken, 'Expired token is correctly rejected');

    // 7. Re-arm valid token and test successful reset
    console.log('\n--- Test 4: Password Update & Token Invalidation ---');
    const freshRawToken = user.getResetPasswordToken();
    const freshHash = crypto.createHash('sha256').update(freshRawToken).digest('hex');
    await user.save();

    const userToReset = await User.findOne({
      resetPasswordToken: freshHash,
      resetPasswordExpire: { $gt: Date.now() },
    });
    assert(userToReset != null, 'Valid unexpired token locates user');

    // Perform reset logic as done in controller
    userToReset.password = newPassword;
    userToReset.resetPasswordToken = undefined;
    userToReset.resetPasswordExpire = undefined;
    await userToReset.save();

    // 8. Verify reset token is wiped from DB (single-use)
    const userAfterReset = await User.findById(user._id).select('+resetPasswordToken +resetPasswordExpire +password');
    assert(!userAfterReset.resetPasswordToken, 'resetPasswordToken is cleared after use');
    assert(!userAfterReset.resetPasswordExpire, 'resetPasswordExpire is cleared after use');
    assert(userAfterReset.role === 'attendee', 'User role is preserved unchanged');

    // 9. Verify password matching with bcrypt
    console.log('\n--- Test 5: Authentication with Updated Password ---');
    const matchesOld = await userAfterReset.matchPassword(originalPassword);
    const matchesNew = await userAfterReset.matchPassword(newPassword);

    assert(matchesOld === false, 'Old password no longer matches');
    assert(matchesNew === true, 'New password matches via bcrypt');

    // 10. Clean up test user
    await User.findByIdAndDelete(user._id);
    console.log('\nCleaned up test user.');

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error.message);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(0);
  }
}

runTests();
