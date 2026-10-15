/**
 * UTSAV — Safe Legacy Data Migration Utility
 * 
 * Context & Purpose:
 * When UTSAV was connected to the shared MongoDB database previously used by the HRMS portal,
 * user accounts were created under the HRMS schema.
 * - HRMS accounts have roles: EMPLOYEE, HR, MANAGER, ADMIN
 * - HRMS accounts stored personal names in a separate 'employees' collection (via employeeId or userId)
 * - UTSAV requires name: String and role: 'attendee' | 'organizer' | 'admin'
 * 
 * This script allows administrators to safely inspect and (optionally) migrate legacy accounts:
 * 1. Safe name resolution: Looks up firstName + lastName from 'employees' collection (never invents names).
 * 2. Role handling: By default, preserves legacy roles. Only updates role if explicitly requested.
 * 
 * Usage:
 *   node src/scripts/migrateLegacyUsers.js               # Dry-run inspection
 *   node src/scripts/migrateLegacyUsers.js --apply       # Populate missing names from employee records
 *   node src/scripts/migrateLegacyUsers.js --apply --migrate-roles  # Also map EMPLOYEE -> attendee
 */

import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

const isApply = process.argv.includes('--apply');
const isMigrateRoles = process.argv.includes('--migrate-roles');

async function runMigration() {
  console.log('====================================================');
  console.log('🔄 UTSAV Safe Legacy Data Migration Tool');
  console.log(`Mode: ${isApply ? '🚀 APPLY CHANGES' : '🔍 DRY-RUN (No changes will be written)'}`);
  console.log('====================================================\n');

  try {
    await connectDB();
    const db = mongoose.connection.db;

    const users = await db.collection('users').find({}).toArray();
    console.log(`Inspecting ${users.length} total user accounts in database...\n`);

    let legacyCount = 0;
    let nameResolvedCount = 0;
    let roleMismatchCount = 0;

    for (const user of users) {
      const isMissingName = !user.name || !user.name.trim();
      const isLegacyRole = !['attendee', 'organizer', 'admin'].includes(user.role);

      if (isMissingName || isLegacyRole) {
        legacyCount++;
        console.log(`[User ${user._id}] ${user.email}:`);

        const updates = {};

        // 1. Resolve missing name from employees collection
        if (isMissingName) {
          let employee = null;
          if (user.employeeId) {
            employee = await db.collection('employees').findOne({ _id: user.employeeId });
          }
          if (!employee) {
            employee = await db.collection('employees').findOne({ userId: user._id });
          }

          if (employee && (employee.firstName || employee.lastName)) {
            const resolvedName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
            updates.name = resolvedName;
            console.log(`  • Missing name -> Resolved from employees collection: "${resolvedName}"`);
            nameResolvedCount++;
          } else {
            console.log(`  • Missing name -> No linked employee record found. Skipping name (never inventing names).`);
          }
        }

        // 2. Role analysis
        if (isLegacyRole) {
          roleMismatchCount++;
          console.log(`  • Legacy role: "${user.role}" (Origin: HRMS Enterprise Role)`);
          if (isMigrateRoles) {
            // Only migrate if explicit command line argument was passed
            if (user.role === 'EMPLOYEE') {
              updates.role = 'attendee';
              console.log(`  • Role migration enabled -> Will map "${user.role}" to "attendee"`);
            } else {
              console.log(`  • Role is "${user.role}" -> Retaining as legacy (not auto-converting non-employee)`);
            }
          } else {
            console.log(`  • Role migration NOT enabled -> Role remains "${user.role}" to prevent unintended permission changes.`);
          }
        }

        // Apply updates if requested
        if (isApply && Object.keys(updates).length > 0) {
          await db.collection('users').updateOne(
            { _id: user._id },
            { $set: updates }
          );
          console.log(`  ✅ Applied updates to database.`);
        }

        console.log('');
      }
    }

    console.log('====================================================');
    console.log('📊 Migration Summary:');
    console.log(`  • Total legacy/incomplete accounts found: ${legacyCount}`);
    console.log(`  • Names resolvable from employee records: ${nameResolvedCount}`);
    console.log(`  • Accounts with legacy HRMS roles: ${roleMismatchCount}`);
    if (!isApply) {
      console.log('\n💡 To write resolved names to database, run:');
      console.log('   node src/scripts/migrateLegacyUsers.js --apply');
      console.log('💡 To also migrate EMPLOYEE roles to attendee, run:');
      console.log('   node src/scripts/migrateLegacyUsers.js --apply --migrate-roles');
    } else {
      console.log('\n✅ Database updates applied safely.');
    }
    console.log('====================================================\n');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(0);
  }
}

runMigration();
