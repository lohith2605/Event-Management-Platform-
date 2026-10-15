import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const bootstrapAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('Error: MONGODB_URI is not defined in environment variables.');
      process.exit(1);
    }

    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri);
    console.log('Connected successfully.');

    const adminName = process.env.ADMIN_NAME || 'UTSAV System Administrator';
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@utsav2026Secure';

    if (adminPassword.length < 6) {
      console.error('Error: ADMIN_PASSWORD must be at least 6 characters long.');
      process.exit(1);
    }

    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log(`Admin account for '${adminEmail}' already exists. Updating credentials...`);
      existingAdmin.role = 'admin';
      existingAdmin.name = adminName;
      existingAdmin.password = adminPassword; // Triggers bcrypt hash in pre('save')
      await existingAdmin.save();
      console.log(`Updated user '${adminEmail}' with new password and verified role: admin.`);
    } else {
      console.log(`Creating new Administrator account for '${adminEmail}'...`);
      const newAdmin = await User.create({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
      });
      console.log(`Successfully provisioned Administrator account: ID ${newAdmin._id}, Role: ${newAdmin.role}`);
    }

    console.log('Admin provisioning completed safely.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Admin provisioning failed:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

bootstrapAdmin();
