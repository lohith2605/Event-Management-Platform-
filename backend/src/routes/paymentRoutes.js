import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  createOrder,
  verifyPayment,
  recordPaymentFailure,
} from '../controllers/paymentController.js';

const router = express.Router();

// All payment endpoints require authenticated session
router.use(protect);

router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.post('/failure', recordPaymentFailure);

export default router;
