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
import {
  createOrganizerCoupon,
  getOrganizerCoupons,
  getOrganizerCouponStats,
  getOrganizerCouponById,
  updateOrganizerCoupon,
  toggleOrganizerCouponStatus,
  deleteOrganizerCoupon,
} from '../controllers/organizerCouponController.js';
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

// Coupons & Discount Management (Feature 13)
router.get('/coupons/stats', getOrganizerCouponStats);
router.get('/coupons', getOrganizerCoupons);
router.post('/coupons', createOrganizerCoupon);
router.get('/coupons/:id', getOrganizerCouponById);
router.put('/coupons/:id', updateOrganizerCoupon);
router.patch('/coupons/:id/status', toggleOrganizerCouponStatus);
router.delete('/coupons/:id', deleteOrganizerCoupon);

export default router;
