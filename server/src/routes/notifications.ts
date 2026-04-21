import { Router } from 'express';
import {
    getUnreadCount,
    markAsRead,
    getNotifications,
    markNotificationRead,
    getUnreadNotificationCount,
    checkProfileCompletion,
    deleteNotification,
    bulkDeleteNotifications
} from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Profile Completion Check
router.get('/check-profile', checkProfileCompletion);

// Chat Notifications
router.get('/unread-count', getUnreadCount);
router.post('/mark-read/:chatId', markAsRead);

// System/Listing Notifications
router.get('/', getNotifications);
router.get('/unread-system', getUnreadNotificationCount);
router.post('/:id/read', markNotificationRead);
router.delete('/bulk', bulkDeleteNotifications);
router.delete('/:id', deleteNotification);

export default router;
