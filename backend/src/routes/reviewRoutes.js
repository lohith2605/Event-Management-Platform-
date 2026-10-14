import express from 'express';
import {
  getEventReviews,
  getMyReviews,
  createOrUpdateReview,
} from '../controllers/reviewController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// Public: View reviews for an event
router.get('/event/:eventId', getEventReviews);

// Private: Attendee review operations
router.get('/my-reviews', protect, getMyReviews);
router.post('/', protect, createOrUpdateReview);

export default router;
