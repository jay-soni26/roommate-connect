import { Router } from 'express';
import { createRoom, getRooms, getRoomById, getMyRooms, deleteRoom, updateRoom, toggleFavorite, getFavorites } from '../controllers/roomController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', getRooms); // Public
router.get('/my-rooms', authenticateToken, getMyRooms); // Protected
router.get('/my-favorites', authenticateToken, getFavorites);
router.post('/toggle-favorite', authenticateToken, toggleFavorite);
router.get('/:id', getRoomById); // Public
router.post('/', authenticateToken, createRoom); // Protected
router.put('/:id', authenticateToken, updateRoom); // Protected
router.delete('/:id', authenticateToken, deleteRoom); // Protected


export default router;
