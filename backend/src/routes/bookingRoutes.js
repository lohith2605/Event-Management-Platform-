import express from 'express';
import {
  createBooking,
  validateCouponForCheckout,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getAttendeeStats,
} from '../controllers/bookingController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// All booking routes require authenticated session
router.use(protect);

router.post('/', createBooking);
router.post('/validate-coupon', validateCouponForCheckout);
router.get('/my-bookings', getMyBookings);
router.get('/overview-stats', getAttendeeStats);
router.get('/:id', getBookingById);
router.post('/:id/cancel', cancelBooking);

export default router;
