import { Router } from 'express';
import { getProfile, updateProfile, findRoommates, changePassword, deleteAccount, getSuperAdmin } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/roommates', findRoommates); // Public or Protected? Let's make public for visibility
router.get('/profile', authenticateToken, getProfile); // Get own profile
router.get('/profile/:userId', getProfile); // Get public profile
router.put('/profile', authenticateToken, updateProfile);
router.post('/change-password', authenticateToken, changePassword);
router.get('/super-admin', getSuperAdmin);
router.delete('/account', authenticateToken, deleteAccount);

export default router;
