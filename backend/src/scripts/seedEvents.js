import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Event from '../models/Event.js';
import User from '../models/User.js';

dotenv.config();

const seedEvents = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('Error: MONGODB_URI not found.');
      process.exit(1);
    }

    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
    console.log('Connected successfully.');

    // Find an organizer in database
    let organizer = await User.findOne({ role: 'organizer' });
    if (!organizer) {
      organizer = await User.create({
        name: 'IIT Delhi Rendezvous Council',
        email: 'organizer@utsav.in',
        password: 'Password123!',
        role: 'organizer',
      });
      console.log('Created host organizer account.');
    }

    // Check existing published events
    const existingCount = await Event.countDocuments({ status: 'published' });
    if (existingCount > 0) {
      console.log(`Database already has ${existingCount} published events.`);
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('Seeding initial genuine published events...');
    await Event.create([
      {
        title: 'HackBangalore 2026: 36h Agentic AI Hackathon',
        tagline: 'Build generative AI agents and scalable distributed systems with 500+ builders.',
        description: 'Join the premier collegiate and indie tech hackathon of the year. Featuring mentorship tracks in autonomous agent swarms, tool calling, and multimodal intelligence. Top 10 teams pitch directly to lead angel syndicates.',
        category: 'Technology & Hackathons',
        date: 'Nov 14 - 16, 2026',
        isoDate: new Date('2026-11-14T09:00:00.000Z'),
        time: '09:00 AM IST',
        city: 'Bengaluru',
        venue: 'Koramangala Indoor Arena, Bengaluru',
        price: 'Free',
        priceNumber: 0,
        image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80',
        organizer: organizer.name,
        organizerId: organizer._id,
        isFeatured: true,
        tags: ['AI', 'Hackathon', 'Open Source'],
        spotsLeft: 42,
        totalCapacity: 500,
        format: 'In-Person',
        status: 'published',
      },
      {
        title: 'Dhwani Sufi & Folk Night: Rajasthan Heritage Tour',
        tagline: 'An evocative open-air evening of traditional Manganiyar vocals and fusion acoustic rhythm.',
        description: 'Immerse yourself in Rajasthan rich melodic heritage beneath the starlit ramparts of Albert Hall. Featuring world-renowned desert vocalists, morchang masters, and acoustic fusion percussions.',
        category: 'Music & Concerts',
        date: 'Nov 20, 2026',
        isoDate: new Date('2026-11-20T18:30:00.000Z'),
        time: '06:30 PM IST',
        city: 'Jaipur',
        venue: 'Albert Hall Open Grounds, Jaipur',
        price: '₹799',
        priceNumber: 799,
        image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
        organizer: 'Jaipur Sangeet Sansthan',
        organizerId: organizer._id,
        isFeatured: true,
        tags: ['Live Music', 'Folk', 'Cultural'],
        spotsLeft: 120,
        totalCapacity: 1200,
        format: 'In-Person',
        status: 'published',
      },
    ]);

    console.log('Successfully seeded 2 genuine published events into MongoDB Atlas.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

seedEvents();
