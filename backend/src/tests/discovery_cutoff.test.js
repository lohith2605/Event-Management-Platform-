import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Event from '../models/Event.js';
import User from '../models/User.js';
import {
  getEventStartDateTime,
  isEventStarted,
  getIstDateBounds,
} from '../utils/eventDateUtils.js';
import {
  getPublishedEvents,
  getEventCategories,
  getOrganizerEvents,
} from '../controllers/eventController.js';

// Helper to simulate Express req, res, next
const createMockReqRes = ({ params = {}, query = {}, user = {}, body = {}, _referenceDate } = {}) => {
  const req = { params, query, user, body, _referenceDate };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  const next = (err) => {
    if (err) {
      statusCode = err.status || 500;
      responseData = { success: false, message: err.message };
    }
  };

  return {
    req,
    res,
    next,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
};

test('UTSAV Phase 2 — Exclude Started Events from Attendee Discovery Test Suite', async (t) => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 15000 });
  }

  const runId = Date.now();
  let organizerUser, adminUser;

  // Setup test users
  organizerUser = await User.create({
    name: 'Discovery Organizer',
    email: `discovery_org_${runId}@example.com`,
    password: 'Password123!',
    role: 'organizer',
  });

  adminUser = await User.create({
    name: 'Discovery Admin',
    email: `discovery_admin_${runId}@example.com`,
    password: 'Password123!',
    role: 'admin',
  });

  t.after(async () => {
    await User.deleteMany({ email: { $regex: `${runId}` } });
    await Event.deleteMany({ title: { $regex: `${runId}` } });
    await mongoose.disconnect();
  });

  // =========================================================================
  // SCENARIO 1: Past published events excluded from default public discovery
  // =========================================================================
  await t.test('1. Past published events are excluded from default public discovery', async () => {
    const pastEvent = await Event.create({
      title: `Past Music Fest ${runId}`,
      tagline: 'Concluded show',
      description: 'Historical festival',
      category: 'Concerts',
      date: 'Oct 10, 2026',
      isoDate: new Date('2026-10-10T00:00:00.000Z'),
      time: '10:00 AM IST',
      city: 'Mumbai',
      venue: 'MMRDA Grounds',
      price: 'Free',
      priceNumber: 0,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 50,
      totalCapacity: 100,
      status: 'published',
    });

    const mock = createMockReqRes({
      query: { search: `Past Music Fest ${runId}` },
      _referenceDate: new Date('2026-10-23T12:00:00.000Z'),
    });

    await getPublishedEvents(mock.req, mock.res, mock.next);
    assert.equal(mock.getStatus(), 200);
    const data = mock.getData();
    assert.equal(data.success, true);
    assert.equal(data.total, 0, 'Past event must not be counted in total');
    assert.equal(data.events.length, 0, 'Past event must not be returned in events array');
  });

  // =========================================================================
  // SCENARIO 2: Future events with valid start times included
  // =========================================================================
  await t.test('2. Future events with valid start times are included in discovery', async () => {
    const futureEvent = await Event.create({
      title: `Future Tech Hackathon ${runId}`,
      tagline: 'Upcoming hackathon',
      description: 'Build projects',
      category: 'Hackathons',
      date: 'Nov 15, 2026',
      isoDate: new Date('2026-11-15T00:00:00.000Z'),
      time: '09:00 AM IST',
      city: 'Bengaluru',
      venue: 'Koramangala Indoor Stadium',
      price: 'Free',
      priceNumber: 0,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 100,
      totalCapacity: 200,
      status: 'published',
    });

    const mock = createMockReqRes({
      query: { search: `Future Tech Hackathon ${runId}` },
      _referenceDate: new Date('2026-10-23T12:00:00.000Z'),
    });

    await getPublishedEvents(mock.req, mock.res, mock.next);
    assert.equal(mock.getStatus(), 200);
    const data = mock.getData();
    assert.equal(data.success, true);
    assert.equal(data.total, 1, 'Future event must be included in total');
    assert.equal(data.events.length, 1);
    assert.equal(data.events[0]._id.toString(), futureEvent._id.toString());
  });

  // =========================================================================
  // SCENARIO 3: An event later today is included only before its actual start time
  // =========================================================================
  await t.test('3. An event later today is included before start time and excluded after', async () => {
    // Reference instant: Oct 23, 2026 at 14:00 IST (08:30 UTC)
    const beforeInstant = new Date('2026-10-23T08:30:00.000Z');
    // Event scheduled for Oct 23, 2026 at 18:00 IST (12:30 UTC)
    const todayEvent = await Event.create({
      title: `Today Evening Gala ${runId}`,
      tagline: 'Happening tonight',
      description: 'Evening show',
      category: 'Cultural',
      date: 'Oct 23, 2026',
      isoDate: new Date('2026-10-23T00:00:00.000Z'),
      time: '06:00 PM IST',
      city: 'Delhi',
      venue: 'Siri Fort Auditorium',
      price: '₹500',
      priceNumber: 500,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 80,
      totalCapacity: 100,
      status: 'published',
    });

    // 3a. Queried at 14:00 IST (before 18:00 IST start time) -> MUST BE INCLUDED
    const mockBefore = createMockReqRes({
      query: { search: `Today Evening Gala ${runId}`, date: 'today' },
      _referenceDate: beforeInstant,
    });
    await getPublishedEvents(mockBefore.req, mockBefore.res, mockBefore.next);
    assert.equal(mockBefore.getStatus(), 200);
    const dataBefore = mockBefore.getData();
    assert.equal(dataBefore.total, 1, 'Should be discoverable before scheduled start');
    assert.equal(dataBefore.events[0]._id.toString(), todayEvent._id.toString());

    // 3b. Queried at 18:30 IST (13:00 UTC, 30 mins after start time) -> MUST BE EXCLUDED
    const afterInstant = new Date('2026-10-23T13:00:00.000Z');
    const mockAfter = createMockReqRes({
      query: { search: `Today Evening Gala ${runId}`, date: 'today' },
      _referenceDate: afterInstant,
    });
    await getPublishedEvents(mockAfter.req, mockAfter.res, mockAfter.next);
    assert.equal(mockAfter.getStatus(), 200);
    const dataAfter = mockAfter.getData();
    assert.equal(dataAfter.total, 0, 'Must be hidden once start time has passed');
    assert.equal(dataAfter.events.length, 0);
  });

  // =========================================================================
  // SCENARIO 4: An event exactly at its start time is excluded
  // =========================================================================
  await t.test('4. An event exactly at its start time is excluded', async () => {
    // Scheduled for 10:00 AM IST (04:30 UTC)
    const exactStartUtc = new Date('2026-11-10T04:30:00.000Z');
    const exactEvent = await Event.create({
      title: `Exact Instant Conclave ${runId}`,
      tagline: 'Exact cutoff testing',
      description: 'Cutoff event',
      category: 'Conferences',
      date: 'Nov 10, 2026',
      isoDate: new Date('2026-11-10T00:00:00.000Z'),
      time: '10:00 AM IST',
      city: 'Pune',
      venue: 'Balewadi Stadium',
      price: 'Free',
      priceNumber: 0,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 50,
      totalCapacity: 100,
      status: 'published',
    });

    const mockExact = createMockReqRes({
      query: { search: `Exact Instant Conclave ${runId}` },
      _referenceDate: exactStartUtc, // Current instant matches event start instant
    });

    await getPublishedEvents(mockExact.req, mockExact.res, mockExact.next);
    assert.equal(mockExact.getStatus(), 200);
    const data = mockExact.getData();
    assert.equal(data.total, 0, 'Event exactly at its start time must be excluded from discovery');
    assert.equal(data.events.length, 0);
  });

  // =========================================================================
  // SCENARIO 5: Invalid or ambiguous start times are excluded
  // =========================================================================
  await t.test('5. Invalid or ambiguous start times are excluded from discovery', async () => {
    // Ambiguous event: isoDate has 00:00:00 UTC and invalid time string
    const invalidTimeEvent = await Event.create({
      title: `Invalid Time Event ${runId}`,
      tagline: 'Bad time',
      description: 'Bad time string',
      category: 'Workshops',
      date: 'Nov 20, 2026',
      isoDate: new Date('2026-11-20T00:00:00.000Z'),
      time: 'TBD or Soon',
      city: 'Hyderabad',
      venue: 'HICC',
      price: 'Free',
      priceNumber: 0,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 50,
      totalCapacity: 100,
      status: 'published',
    });

    const mock = createMockReqRes({
      query: { search: `Invalid Time Event ${runId}` },
      _referenceDate: new Date('2026-10-23T12:00:00.000Z'),
    });

    await getPublishedEvents(mock.req, mock.res, mock.next);
    assert.equal(mock.getStatus(), 200);
    const data = mock.getData();
    assert.equal(data.total, 0, 'Event with ambiguous/unparseable start time must be excluded');
  });

  // =========================================================================
  // SCENARIO 6: Featured results exclude started events
  // =========================================================================
  await t.test('6. Featured results exclude started events', async () => {
    const pastFeatured = await Event.create({
      title: `Past Featured Summit ${runId}`,
      tagline: 'Past spotlight',
      description: 'Concluded spotlight',
      category: 'Conferences',
      date: 'Oct 05, 2026',
      isoDate: new Date('2026-10-05T00:00:00.000Z'),
      time: '10:00 AM IST',
      city: 'Mumbai',
      venue: 'BKC Center',
      price: '₹1200',
      priceNumber: 1200,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      isFeatured: true,
      spotsLeft: 20,
      totalCapacity: 100,
      status: 'published',
    });

    const futureFeatured = await Event.create({
      title: `Future Featured Summit ${runId}`,
      tagline: 'Future spotlight',
      description: 'Upcoming spotlight',
      category: 'Conferences',
      date: 'Nov 25, 2026',
      isoDate: new Date('2026-11-25T00:00:00.000Z'),
      time: '10:00 AM IST',
      city: 'Mumbai',
      venue: 'BKC Center',
      price: '₹1500',
      priceNumber: 1500,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      isFeatured: true,
      spotsLeft: 30,
      totalCapacity: 100,
      status: 'published',
    });

    const mock = createMockReqRes({
      query: { featured: 'true', search: `Featured Summit ${runId}` },
      _referenceDate: new Date('2026-10-23T12:00:00.000Z'),
    });

    await getPublishedEvents(mock.req, mock.res, mock.next);
    assert.equal(mock.getStatus(), 200);
    const data = mock.getData();
    assert.equal(data.total, 1, 'Only upcoming featured event should be returned');
    assert.equal(data.events[0]._id.toString(), futureFeatured._id.toString());
  });

  // =========================================================================
  // SCENARIO 7: Carousel fallback results exclude started events
  // =========================================================================
  await t.test('7. Carousel fallback results exclude started events', async () => {
    // Carousel queries upcoming published events sorted soonest
    const mock = createMockReqRes({
      query: { limit: 8, sort: 'soonest', search: `${runId}` },
      _referenceDate: new Date('2026-10-23T12:00:00.000Z'),
    });

    await getPublishedEvents(mock.req, mock.res, mock.next);
    assert.equal(mock.getStatus(), 200);
    const data = mock.getData();
    // Every event in data.events must have startDateTime > reference instant
    const refInstant = new Date('2026-10-23T12:00:00.000Z');
    for (const evt of data.events) {
      const start = getEventStartDateTime(evt);
      assert.ok(start, 'Every returned event must have a valid start timestamp');
      assert.ok(start.getTime() > refInstant.getTime(), `Event ${evt.title} has started but was returned in carousel fallback`);
    }
  });

  // =========================================================================
  // SCENARIO 8: Filtering and pagination return correct eligible results and counts
  // =========================================================================
  await t.test('8. Filtering and pagination return exact eligible totals and full pages', async () => {
    const pageToken = `page_${runId}`;
    // Create 5 future events and 3 past events
    for (let i = 1; i <= 5; i++) {
      await Event.create({
        title: `Pagination Future Event ${i} ${pageToken}`,
        tagline: 'Page test',
        description: 'Pagination description',
        category: 'Sports',
        date: `Nov 0${i}, 2026`,
        isoDate: new Date(`2026-11-0${i}T00:00:00.000Z`),
        time: '04:00 PM IST',
        city: 'Chennai',
        venue: 'Marina Arena',
        price: 'Free',
        priceNumber: 0,
        organizer: organizerUser.name,
        organizerId: organizerUser._id,
        spotsLeft: 50,
        totalCapacity: 100,
        status: 'published',
      });
    }
    for (let j = 1; j <= 3; j++) {
      await Event.create({
        title: `Pagination Past Event ${j} ${pageToken}`,
        tagline: 'Page past',
        description: 'Pagination past',
        category: 'Sports',
        date: `Oct 0${j}, 2026`,
        isoDate: new Date(`2026-10-0${j}T00:00:00.000Z`),
        time: '04:00 PM IST',
        city: 'Chennai',
        venue: 'Marina Arena',
        price: 'Free',
        priceNumber: 0,
        organizer: organizerUser.name,
        organizerId: organizerUser._id,
        spotsLeft: 50,
        totalCapacity: 100,
        status: 'published',
      });
    }

    // Page 1 with limit 2
    const mockP1 = createMockReqRes({
      query: { search: pageToken, page: 1, limit: 2, sort: 'soonest' },
      _referenceDate: new Date('2026-10-23T12:00:00.000Z'),
    });
    await getPublishedEvents(mockP1.req, mockP1.res, mockP1.next);
    const dataP1 = mockP1.getData();
    assert.equal(dataP1.total, 5, 'Total count must reflect only the 5 eligible future events');
    assert.equal(dataP1.pages, 3, '5 events with limit 2 must equal 3 pages');
    assert.equal(dataP1.events.length, 2, 'Page 1 must return full 2 items');

    // Page 3 with limit 2 (last page)
    const mockP3 = createMockReqRes({
      query: { search: pageToken, page: 3, limit: 2, sort: 'soonest' },
      _referenceDate: new Date('2026-10-23T12:00:00.000Z'),
    });
    await getPublishedEvents(mockP3.req, mockP3.res, mockP3.next);
    const dataP3 = mockP3.getData();
    assert.equal(dataP3.events.length, 1, 'Page 3 must return the 1 remaining item');
  });

  // =========================================================================
  // SCENARIO 9: Existing category, city, search, and date filters still work
  // =========================================================================
  await t.test('9. Existing category, city, search, and date filters work as expected', async () => {
    const filterToken = `filt_${runId}`;
    const testCity = 'Kolkata';

    await Event.create({
      title: `Art Workshop ${filterToken}`,
      tagline: 'Paint with oils',
      description: 'Hands-on workshop',
      category: 'Workshops',
      date: 'Nov 18, 2026',
      isoDate: new Date('2026-11-18T00:00:00.000Z'),
      time: '11:00 AM IST',
      city: testCity,
      venue: 'Victoria Memorial Hall',
      price: '₹350',
      priceNumber: 350,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 25,
      totalCapacity: 30,
      status: 'published',
    });

    // 9a. Category filter
    const mockCat = createMockReqRes({
      query: { category: 'Workshops', search: filterToken },
      _referenceDate: new Date('2026-10-23T12:00:00.000Z'),
    });
    await getPublishedEvents(mockCat.req, mockCat.res, mockCat.next);
    assert.equal(mockCat.getData().total, 1);

    // 9b. Non-matching category
    const mockWrongCat = createMockReqRes({
      query: { category: 'Concerts', search: filterToken },
      _referenceDate: new Date('2026-10-23T12:00:00.000Z'),
    });
    await getPublishedEvents(mockWrongCat.req, mockWrongCat.res, mockWrongCat.next);
    assert.equal(mockWrongCat.getData().total, 0);

    // 9c. City filter
    const mockCity = createMockReqRes({
      query: { city: testCity, search: filterToken },
      _referenceDate: new Date('2026-10-23T12:00:00.000Z'),
    });
    await getPublishedEvents(mockCity.req, mockCity.res, mockCity.next);
    assert.equal(mockCity.getData().total, 1);

    // 9d. Category counts in getEventCategories only include upcoming events
    const mockCounts = createMockReqRes({
      _referenceDate: new Date('2026-10-23T12:00:00.000Z'),
    });
    await getEventCategories(mockCounts.req, mockCounts.res, mockCounts.next);
    const catData = mockCounts.getData();
    assert.equal(catData.success, true);
    assert.ok(typeof catData.categories === 'object');
    assert.ok((catData.categories['Workshops'] || 0) >= 1);
  });

  // =========================================================================
  // SCENARIO 10: Historical organizer/admin event listings remain unaffected
  // =========================================================================
  await t.test('10. Historical organizer/admin event listings remain unaffected', async () => {
    // Both past and future events must remain accessible in organizer and admin management
    const mockOrg = createMockReqRes({
      user: organizerUser,
    });
    await getOrganizerEvents(mockOrg.req, mockOrg.res, mockOrg.next);
    assert.equal(mockOrg.getStatus(), 200);
    const orgData = mockOrg.getData();
    assert.ok(orgData.events.length > 0, 'Organizer must be able to view all created events, including past ones');
    const hasPast = orgData.events.some((e) => e.title.includes('Past Music Fest'));
    const hasFuture = orgData.events.some((e) => e.title.includes('Future Tech Hackathon'));
    assert.ok(hasPast, 'Past events must still appear in organizer management');
    assert.ok(hasFuture, 'Future events must still appear in organizer management');

    // Admin management view
    const mockAdmin = createMockReqRes({
      user: adminUser,
    });
    await getOrganizerEvents(mockAdmin.req, mockAdmin.res, mockAdmin.next);
    assert.equal(mockAdmin.getStatus(), 200);
    const adminData = mockAdmin.getData();
    assert.ok(adminData.events.length >= orgData.events.length, 'Admin must have complete access to all events');
  });
});
