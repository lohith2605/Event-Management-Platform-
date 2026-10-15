import express from 'express';
import {
  getOrganizerOverview,
  getOrganizerEvents,
  getOrganizerEventById,
  createOrganizerEvent,
  updateOrganizerEvent,
  cancelOrganizerEvent,
  getOrganizerBookings,
  getOrganizerAttendees,
  getOrganizerAnalytics,
} from '../controllers/organizerController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Enforce authentication & role authorization for all organizer routes
router.use(protect);
router.use(authorize('organizer', 'admin'));

// Overview & high-level genuine metrics
router.get('/overview', getOrganizerOverview);

// Event management
router.get('/events', getOrganizerEvents);
router.post('/events', createOrganizerEvent);
router.get('/events/:id', getOrganizerEventById);
router.put('/events/:id', updateOrganizerEvent);
router.post('/events/:id/cancel', cancelOrganizerEvent);

// Bookings & Attendees
router.get('/bookings', getOrganizerBookings);
router.get('/attendees', getOrganizerAttendees);

// Analytics
router.get('/analytics', getOrganizerAnalytics);

export default router;
