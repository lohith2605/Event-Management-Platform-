import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';

async function migrateRoles() {
  await connectDB();

  console.log('--- Migrating Legacy Roles to UTSAV Standard Roles ---');
  const r1 = await User.updateMany(
    { role: { $in: ['ADMIN', 'Admin'] } },
    { $set: { role: 'admin' } }
  );

  const r2 = await User.updateMany(
    { role: { $in: ['EMPLOYEE', 'HR', 'MANAGER', 'employee', 'hr', 'manager', 'user', 'Attendee'] } },
    { $set: { role: 'attendee' } }
  );

  const r3 = await User.updateMany(
    { role: { $in: ['Organizer', 'ORGANIZER'] } },
    { $set: { role: 'organizer' } }
  );

  console.log('Admins normalized:', r1.modifiedCount);
  console.log('Attendees normalized:', r2.modifiedCount);
  console.log('Organizers normalized:', r3.modifiedCount);

  const allRoles = await User.distinct('role');
  console.log('Distinct roles now in database:', allRoles);

  await mongoose.disconnect();
}

migrateRoles();
