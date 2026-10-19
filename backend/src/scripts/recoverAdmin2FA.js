import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { generateRecoveryCodes } from '../utils/totp.js';

dotenv.config();

/**
 * Administrative Recovery CLI Tool for UTSAV Platform Administrators
 * Usage: node src/scripts/recoverAdmin2FA.js <admin-email>
 */
async function runAdminRecovery() {
  const args = process.argv.slice(2);
  const targetEmail = (args[0] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  if (!targetEmail) {
    console.error('❌ Error: Target administrator email is required.');
    console.log('Usage: node src/scripts/recoverAdmin2FA.js <admin-email>');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ Error: MONGODB_URI is not defined.');
    process.exit(1);
  }

  try {
    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);

    const admin = await User.findOne({ email: targetEmail });
    if (!admin) {
      console.error(`❌ Error: No account found with email '${targetEmail}'.`);
      process.exit(1);
    }

    if (admin.role !== 'admin') {
      console.error(`❌ Security Error: Account '${targetEmail}' is not an administrator. Non-admin recovery through this tool is prohibited.`);
      process.exit(1);
    }

    console.log(`\n🔒 Initiating 2FA Recovery for Administrator: ${admin.name} (${admin.email})`);

    // Generate a fresh set of one-time emergency recovery codes
    const { plainCodes, hashedRecords } = generateRecoveryCodes(8);

    admin.recoveryCodes = hashedRecords;
    admin.totpPendingSecret = undefined;
    admin.twoFactorAttempts = 0;
    // Reset totpEnrolled so the admin can either use a recovery code or re-enroll upon next sign-in
    admin.totpEnrolled = false;
    admin.totpSecret = undefined;
    await admin.save({ validateBeforeSave: false });

    // Record audit trail
    await AuditLog.create({
      adminId: admin._id,
      adminEmail: admin.email,
      adminName: admin.name,
      action: 'admin_2fa_recovery',
      targetType: 'User',
      targetId: String(admin._id),
      targetTitle: admin.name,
      details: 'Administrator 2FA state reset via secure local CLI recovery tool. New emergency recovery codes provisioned.',
      ipAddress: '127.0.0.1 (CLI)',
    });

    console.log('✅ Admin 2FA reset successfully.');
    console.log('\n===============================================================');
    console.log('🔑 NEW EMERGENCY RECOVERY CODES PROVISIONED (STORE SECURELY):');
    console.log('===============================================================');
    plainCodes.forEach((code, idx) => {
      console.log(`  [${idx + 1}] ${code}`);
    });
    console.log('===============================================================');
    console.log('ℹ️  On next login, the administrator will be prompted to re-enroll');
    console.log('   their Google Authenticator app or use an emergency recovery code.');
    console.log('===============================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Admin recovery failed:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

runAdminRecovery();
