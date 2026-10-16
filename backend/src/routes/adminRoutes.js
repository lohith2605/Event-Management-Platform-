import express from 'express';
import {
  getAdminStats,
  getAdminEvents,
  getPendingEvents,
  getAdminEventById,
  reviewEvent,
  getAdminUsers,
  getAdminUserById,
  updateUserStatus,
  getAdminBookings,
  getAdminBookingById,
  cancelAndRefundBooking,
  reconcileBookingRefund,
  getAdminReviews,
  moderateReview,
  getAdminAuditLogs,
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  triggerRemindersCheck,
} from '../controllers/adminController.js';
import {
  getAdminCoupons,
  getAdminCouponStats,
  updateAdminCouponStatus,
} from '../controllers/adminCouponController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Strict security: All administrative endpoints are guarded by JWT verification and admin role check
router.use(protect);
router.use(authorize('admin'));

// Platform Overview & Genuine Aggregate Metrics
router.get('/stats', getAdminStats);

// Event Moderation & Governance
router.get('/events', getAdminEvents);
router.get('/events/pending', getPendingEvents);
router.get('/events/:id', getAdminEventById);
router.put('/events/:id/review', reviewEvent);

// User Account Governance & Safety
router.get('/users', getAdminUsers);
router.get('/users/:id', getAdminUserById);
router.put('/users/:id/status', updateUserStatus);

// Booking & Financial Oversight
router.get('/bookings', getAdminBookings);
router.get('/bookings/:id', getAdminBookingById);
router.post('/bookings/:id/cancel-refund', cancelAndRefundBooking);
router.post('/bookings/:id/sync-refund', reconcileBookingRefund);

// Review Moderation
router.get('/reviews', getAdminReviews);
router.put('/reviews/:id/moderate', moderateReview);

// Tamper-evident Audit Logs
router.get('/audit-logs', getAdminAuditLogs);

// Administrative In-App Notifications
router.get('/notifications', getAdminNotifications);
router.put('/notifications/:id/read', markAdminNotificationRead);
router.put('/notifications/read-all', markAllAdminNotificationsRead);

// Automated Event Reminders Trigger
router.post('/reminders/trigger', triggerRemindersCheck);

// Platform Coupon Governance & Moderation (Feature 13)
router.get('/coupons/stats', getAdminCouponStats);
router.get('/coupons', getAdminCoupons);
router.patch('/coupons/:id/status', updateAdminCouponStatus);

export default router;
