import express from 'express';
import { getMyTickets, getTicketById } from '../controllers/ticketController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

router.get('/my-tickets', getMyTickets);
router.get('/:id', getTicketById);

export default router;
