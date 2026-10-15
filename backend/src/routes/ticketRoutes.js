import express from 'express';
import { getMyTickets, getTicketById, checkInTicket } from '../controllers/ticketController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

router.get('/my-tickets', getMyTickets);
router.get('/:id', getTicketById);
router.post('/check-in', checkInTicket);

export default router;
