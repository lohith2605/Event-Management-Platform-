import express from 'express';
import { getAdminStats } from '../controllers/adminController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Protected admin statistics
router.get('/stats', protect, authorize('admin'), getAdminStats);

export default router;
