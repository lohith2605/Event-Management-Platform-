import express from 'express';
import {
  getUserConversations,
  getConversationById,
  createOrGetConversation,
  getConversationMessages,
  searchConversationMessages,
  sendMessage,
  markConversationRead,
  getUnreadCount,
  toggleReaction,
  editMessage,
  deleteMessage,
  uploadChatAttachment,
  downloadAttachment,
  forwardMessage,
  pinMessage,
  unpinMessage,
  getSharedContent,
  deleteConversation,
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
router.delete('/conversations/:id', deleteConversation);
router.get('/conversations/:id/messages/search', searchConversationMessages);
router.get('/conversations/:id/shared', getSharedContent);
router.get('/conversations/:id/messages', getConversationMessages);
router.post('/conversations/:id/messages', sendMessage);
router.post('/conversations/:id/messages/forward', forwardMessage);
router.post('/conversations/:id/forward', forwardMessage);
router.post('/conversations/:id/upload', handleAttachmentUpload, uploadChatAttachment);
router.get('/conversations/:id/messages/:messageId/download', downloadAttachment);
router.put('/conversations/:id/read', markConversationRead);
router.post('/conversations/:id/messages/:messageId/reactions', toggleReaction);
router.put('/conversations/:id/messages/:messageId', editMessage);
router.delete('/conversations/:id/messages/:messageId', deleteMessage);

// Pin and Unpin message routes
router.post('/conversations/:id/messages/:messageId/pin', pinMessage);
router.post('/conversations/:id/pin', pinMessage);
router.delete('/conversations/:id/messages/:messageId/pin', unpinMessage);
router.delete('/conversations/:id/pin', unpinMessage);
router.post('/conversations/:id/unpin', unpinMessage);

export default router;


