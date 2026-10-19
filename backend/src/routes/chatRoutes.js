import express from 'express';
import {
  getUserConversations,
  getConversationById,
  createOrGetConversation,
  getConversationMessages,
  sendMessage,
  markConversationRead,
  getUnreadCount,
} from '../controllers/chatController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// All chat routes are strictly protected by session & JWT authentication
router.use(protect);

router.get('/conversations', getUserConversations);
router.post('/conversations', createOrGetConversation);
router.get('/unread-count', getUnreadCount);

router.get('/conversations/:id', getConversationById);
router.get('/conversations/:id/messages', getConversationMessages);
router.post('/conversations/:id/messages', sendMessage);
router.put('/conversations/:id/read', markConversationRead);

export default router;
