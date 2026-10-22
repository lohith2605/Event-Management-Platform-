import express from 'express';
import {
  getUserConversations,
  getConversationById,
  createOrGetConversation,
  getConversationMessages,
  sendMessage,
  markConversationRead,
  getUnreadCount,
  toggleReaction,
  editMessage,
  deleteMessage,
  uploadChatAttachment,
  downloadAttachment,
} from '../controllers/chatController.js';
import { protect } from '../middlewares/auth.js';
import { handleAttachmentUpload } from '../middlewares/upload.js';

const router = express.Router();

// All chat routes are strictly protected by session & JWT authentication
router.use(protect);

router.get('/conversations', getUserConversations);
router.post('/conversations', createOrGetConversation);
router.get('/unread-count', getUnreadCount);

router.get('/conversations/:id', getConversationById);
router.get('/conversations/:id/messages', getConversationMessages);
router.post('/conversations/:id/messages', sendMessage);
router.post('/conversations/:id/upload', handleAttachmentUpload, uploadChatAttachment);
router.get('/conversations/:id/messages/:messageId/download', downloadAttachment);
router.put('/conversations/:id/read', markConversationRead);
router.post('/conversations/:id/messages/:messageId/reactions', toggleReaction);
router.put('/conversations/:id/messages/:messageId', editMessage);
router.delete('/conversations/:id/messages/:messageId', deleteMessage);

export default router;


