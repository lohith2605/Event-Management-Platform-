import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Event = mongoose.model('Event', new mongoose.Schema({}, { strict: false }));
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

  // 1. Update existing published events to be featured
  const res = await Event.updateMany({ status: 'published' }, { $set: { isFeatured: true } });
  console.log('Marked existing published events as featured:', res.modifiedCount);

  // 2. Find an organizer user
  const organizerUser = await User.findOne({ role: 'organizer' }) || await User.findOne({});
  const orgId = organizerUser ? organizerUser._id : new mongoose.Types.ObjectId('6acf55c4db7418fa4fb8930a');

  // 3. Add Sunburn Campus Arena if not exists
  const existingSunburn = await Event.findOne({ title: /Sunburn/i });
  if (!existingSunburn) {
    await Event.create({
      title: 'Sunburn Campus Arena 2026: Electronic Music Festival',
      tagline: 'Experience India\'s largest campus EDM festival with international headliners and laser soundscapes.',
      description: 'Sunburn Campus Arena lands in Mumbai featuring global trance, house, and bass music artists, state-of-the-art visual production, interactive food lounges, and verified digital admission.',
      category: 'Music & Concerts',
      date: 'Sat, 05 Dec, 2026',
      isoDate: new Date('2026-12-05T18:00:00.000Z'),
      time: '06:00 PM IST',
      city: 'Mumbai',
      venue: 'Jio World Garden, BKC, Mumbai',
      price: '₹1299',
      priceNumber: 1299,
      image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
      organizer: 'Percept Live Entertainment',
      organizerId: orgId,
      isFeatured: true,
      tags: ['Music', 'Concert', 'EDM', 'Festival', 'Mumbai'],
      spotsLeft: 85,
      totalCapacity: 800,
      format: 'In-Person',
      status: 'published'
    });
    console.log('Created: Sunburn Campus Arena 2026');
  }

  // 4. Add India DeepTech Summit if not exists
  const existingDeepTech = await Event.findOne({ title: /DeepTech/i });
  if (!existingDeepTech) {
    await Event.create({
      title: 'India DeepTech Summit & AI Startup Showcase 2026',
      tagline: 'Connect with top angel investors, founders, and research labs shaping quantum computing and frontier AI.',
      description: 'A flagship national innovation convention gathering 100+ deeptech ventures, VC keynote panels, product demos, and VIP networking lounges.',
      category: 'Technology & Hackathons',
      date: 'Fri, 18 Dec, 2026',
      isoDate: new Date('2026-12-18T09:30:00.000Z'),
      time: '09:30 AM IST',
      city: 'Hyderabad',
      venue: 'HICC Novotel Arena, Hitec City, Hyderabad',
      price: 'Free',
      priceNumber: 0,
      image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
      organizer: 'T-Hub Innovation Ecosystem',
      organizerId: orgId,
      isFeatured: true,
      tags: ['Technology', 'AI', 'DeepTech', 'Startup', 'Hyderabad'],
      spotsLeft: 120,
      totalCapacity: 600,
      format: 'Hybrid',
      status: 'published'
    });
    console.log('Created: India DeepTech Summit 2026');
  }

  const allFeatured = await Event.find({ isFeatured: true, status: 'published' }).select('title city price date isFeatured').lean();
  console.log('Total featured published events now:', allFeatured.length);
  allFeatured.forEach((e, idx) => {
    console.log(`[${idx + 1}] ${e.title} (${e.city}) - ${e.price} - ${e.date}`);
  });

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error running script:', err);
  process.exit(1);
});
