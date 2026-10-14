import express from 'express';
import {
  getPublishedEvents,
  getEventCategories,
  getEventById,
  getOrganizerEvents,
  createEvent,
} from '../controllers/eventController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Public routes
router.get('/', getPublishedEvents);
router.get('/categories', getEventCategories);
router.get('/:id', getEventById);

// Protected Organizer routes
router.get('/organizer/my-events', protect, authorize('organizer', 'admin'), getOrganizerEvents);
router.post('/', protect, authorize('organizer', 'admin'), createEvent);

export default router;
