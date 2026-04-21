import { Router } from 'express';
import { login, register } from '../controllers/authController';

const router = Router();

import { authenticateToken } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { prisma } from '../utils';

router.post('/register', register);
router.post('/login', login);

router.get('/check-status', authenticateToken, async (req: AuthRequest, res) => {
    // If it passed middleware, it's not banned (or path is allowed)
    // But since this is a general check, let's just return roles etc
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        res.json({ isBanned: user?.isBanned, role: user?.role });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

export default router;
