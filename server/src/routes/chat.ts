import { Router } from 'express';
import { getConversations, getMessages, startChat, getChatDetails } from '../controllers/chatController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.get('/', getConversations);
router.get('/:chatId/details', getChatDetails);
router.get('/:chatId/messages', getMessages);
router.post('/start', startChat);

export default router;
