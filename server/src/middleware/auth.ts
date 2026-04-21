import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils';

export interface AuthRequest extends Request {
    user?: any;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET || 'secret', async (err: any, user: any) => {
        if (err) return res.sendStatus(403);
        
        // Fast DB check for ban status
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { isBanned: true } });
        if (dbUser?.isBanned) {
            // ONLY ALLOW CHAT AND SUPER-ADMIN ROUTES FOR BANNED USERS
            const allowedForBanned = [
                '/api/chats',
                '/api/users/super-admin',
                '/api/notifications' // to read admin messages
            ];
            
            const isProfileGet = req.originalUrl.startsWith('/api/users/profile') && req.method === 'GET';
            const isMyRoomsGet = req.originalUrl.startsWith('/api/rooms/my-rooms') && req.method === 'GET';
            
            const isAllowed = allowedForBanned.some(path => req.originalUrl.startsWith(path)) || isProfileGet || isMyRoomsGet;
            if (!isAllowed) {
                return res.status(403).json({ error: 'Your account has been restricted. You cannot interact with normal features.', isBanned: true });
            }
        }

        req.user = user;
        next();
    });
};
