import express from 'express';
import {
  getEventReviews,
  getEventReviewEligibility,
  getMyReviews,
  createOrUpdateReview,
  updateReview,
  deleteReview,
} from '../controllers/reviewController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// Public: View reviews for an event
router.get('/event/:eventId', getEventReviews);

// Private: Authenticated attendee review endpoints
router.get('/event/:eventId/eligibility', protect, getEventReviewEligibility);
router.get('/my-reviews', protect, getMyReviews);
router.post('/', protect, createOrUpdateReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

export default router;
