import { Router } from 'express';
import { prisma } from '../utils';
import { getIO, isUserOnline } from '../socket';
import { authenticateToken } from '../middleware/auth';
import { logAdminAction } from '../utils/adminLogger';
import type { AuthRequest } from '../middleware/auth';
import type { Response, NextFunction } from 'express';

import { sendPushNotification } from '../utils/push';

const router = Router();

// Middleware to check if user makes admin requests
const isAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
        if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Access denied: Admin only' });
        }
        next();
    } catch (e) {
        res.status(500).json({ error: 'Server error check role' });
    }
};

router.use(authenticateToken);
router.use(isAdmin);

// Get Dashboard Stats
router.get('/stats', async (req: AuthRequest, res: Response) => {
    try {
        const totalUsers = await prisma.user.count();
        const totalRooms = await prisma.room.count();
        const totalChats = await prisma.chat.count();
        console.log(`[Admin] Stats Request: Users=${totalUsers}, Rooms=${totalRooms}`);
        const recentUsers = await prisma.user.count({
            where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
        });
        const pendingReports = await prisma.report.count({ where: { status: 'PENDING' } });

        res.json({ totalUsers, totalRooms, totalChats, recentUsers, pendingReports });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Get Detailed Analytics for Charts
router.get('/analytics', async (req: AuthRequest, res: Response) => {
    try {
        // 1. User Growth (Daily registrations for last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const users = await prisma.user.findMany({
            where: { createdAt: { gte: thirtyDaysAgo } },
            select: { createdAt: true }
        });

        const growthData: { [date: string]: number } = {};
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            growthData[date.toISOString().split('T')[0]] = 0;
        }

        users.forEach(u => {
            const dateKey = u.createdAt.toISOString().split('T')[0];
            if (growthData[dateKey] !== undefined) {
                growthData[dateKey]++;
            }
        });

        const formattedGrowth = Object.entries(growthData)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // 2. Room Distribution by City
        const cityStats = await prisma.profile.groupBy({
            by: ['city'],
            _count: {
                userId: true
            },
            where: {
                user: {
                    rooms: { some: {} }
                }
            }
        });

        // Alternative if profile grouping is complex based on room ownership
        const roomsWithProfiles = await prisma.room.findMany({
            include: { owner: { include: { profile: true } } }
        });

        const cityDist: { [city: string]: number } = {};
        roomsWithProfiles.forEach(r => {
            const city = r.owner.profile?.city || 'Unknown';
            cityDist[city] = (cityDist[city] || 0) + 1;
        });

        const formattedCityDist = Object.entries(cityDist).map(([name, value]) => ({ name, value }));

        res.json({
            growth: formattedGrowth,
            cityDistribution: formattedCityDist
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Get all users
router.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { role: { not: 'SUPER_ADMIN' } },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, name: true, email: true, role: true, createdAt: true, isBanned: true, phoneNumber: true,
                _count: { select: { rooms: true } },
                profile: {
                    select: {
                        city: true,
                        state: true,
                        gender: true,
                        occupation: true,
                        bio: true
                    }
                }
            }
        });
        res.json(users);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Delete user
router.delete('/users/:id', async (req: AuthRequest, res) => {
    try {
        const adminId = req.user!.id;
        const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
        if (adminUser?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Only Super Admin can permanently delete accounts.' });
        }
        const targetId = Number(req.params.id);

        // Clean up everything associated
        await prisma.message.deleteMany({ where: { OR: [{ senderId: targetId }, { chat: { participants: { some: { id: targetId } } } }] } });
        await prisma.notification.deleteMany({ where: { userId: targetId } });
        await prisma.room.deleteMany({ where: { ownerId: targetId } });
        await prisma.profile.deleteMany({ where: { userId: targetId } });
        await prisma.user.delete({ where: { id: targetId } });

        // Log action
        await logAdminAction(adminId, adminUser!.name, 'DELETE_USER', `Permanently deleted user: ${targetId}`, String(targetId));

        // Realtime broadcast (Global)
        getIO().emit('userDeleted', { userId: targetId });

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Send Notification
router.post('/broadcast', async (req: AuthRequest, res) => {
    try {
        const { targetUserId, targetIds, title, message } = req.body;
        const brand = "RoommateConnect Official";

        if (targetUserId) {
            // Single User - Professional Personal Alert
            await prisma.notification.create({
                data: {
                    userId: Number(targetUserId),
                    type: 'SYSTEM_ALERT',
                    title: `RoommateConnect Official: ${title}`,
                    message,
                    isRead: false
                }
            });
            getIO().to(`user_${targetUserId}`).emit('notification');

            // Push Notification ONLY if offline
            if (!isUserOnline(Number(targetUserId))) {
                prisma.pushSubscription.findMany({ where: { userId: Number(targetUserId) } })
                    .then(subs => {
                        for (const sub of subs) {
                            sendPushNotification(sub, { 
                                title: `Official Update: ${title}`, 
                                body: message, 
                                url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/` 
                            }).catch(e => console.error("Broadcast push error:", e));
                        }
                    });
            }

        } else if (targetIds && Array.isArray(targetIds)) {
            // Targeted Group - Group Focus
            await prisma.notification.createMany({
                data: targetIds.map((id: any) => ({
                    userId: Number(id),
                    type: 'SYSTEM_ALERT',
                    title: `RoommateConnect Update: ${title}`,
                    message,
                    isRead: false
                }))
            });
            targetIds.forEach(async (id: any) => {
                const uid = Number(id);
                getIO().to(`user_${uid}`).emit('notification');
                
                // ONLY if offline
                if (!isUserOnline(uid)) {
                    prisma.pushSubscription.findMany({ where: { userId: uid } })
                        .then(subs => {
                            for (const sub of subs) {
                                sendPushNotification(sub, { 
                                    title: `Official Update: ${title}`, 
                                    body: message, 
                                    url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/` 
                                }).catch(e => console.error("Group broadcast push error:", e));
                            }
                        });
                }
            });
        } else {
            // Global Broadcast - Important Announcement
            const allUsers = await prisma.user.findMany({ select: { id: true } });
            await prisma.notification.createMany({
                data: allUsers.map(u => ({
                    userId: u.id,
                    type: 'GLOBAL_BROADCAST',
                    title: `📢 Announcement: ${title}`,
                    message,
                    isRead: false
                }))
            });
            getIO().emit('notification');

            // Send Push to ALL (Offline only)
            prisma.pushSubscription.findMany()
                .then(allSubs => {
                    for (const sub of allSubs) {
                        if (!isUserOnline(sub.userId)) {
                            sendPushNotification(sub, { 
                                title: `📢 Official Announcement: ${title}`, 
                                body: message, 
                                url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/` 
                            }).catch(e => console.error("Global push error:", e));
                        }
                    }
                });
        }

        // Log broadcast
        await logAdminAction(req.user!.id, 'Admin', 'BROADCAST', `Sent alert: ${title}`, 'BRD');

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Broadcast failed' });
    }
});

// Send Admin direct message
router.post('/message-user', async (req: AuthRequest, res) => {
    try {
        const adminId = req.user!.id;
        const { targetUserId, message } = req.body;
        const recipientId = Number(targetUserId);

        // Ensure chat exists between admin and user
        let chat = await prisma.chat.findFirst({
            where: {
                AND: [
                    { participants: { some: { id: adminId } } },
                    { participants: { some: { id: recipientId } } }
                ]
            }
        });

        if (!chat) {
            chat = await prisma.chat.create({
                data: {
                    participants: { connect: [{ id: adminId }, { id: recipientId }] }
                }
            });
        }

        // Send message
        const newMessage = await prisma.message.create({
            data: {
                chatId: chat.id,
                senderId: adminId,
                content: message,
                isDelivered: false // Initial state
            },
            include: { sender: { select: { id: true, name: true, role: true } } }
        });

        const senderName = newMessage.sender.role === 'SUPER_ADMIN' ? 'RoommateConnect Official' : newMessage.sender.name;

        // Emit realtime message
        getIO().to(`chat_${chat.id}`).emit('newMessage', newMessage);
        getIO().to(`user_${recipientId}`).emit('newChat', chat);

        // Push notification (Direct message from admin) - ONLY IF OFFLINE
        if (!isUserOnline(recipientId)) {
            prisma.pushSubscription.findMany({ where: { userId: recipientId } })
                .then(subs => {
                    for (const sub of subs) {
                        sendPushNotification(sub, {
                            title: `New Message from ${senderName}`,
                            body: message.length > 50 ? message.substring(0, 47) + '...' : message,
                            url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/chat`
                        }).catch(e => console.error("Admin DM push error:", e));
                    }
                });
        }

        res.json({ success: true, chatId: chat.id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to message user' });
    }
});

// Manage Rooms
router.get('/rooms', async (req, res) => {
    try {
        const rooms = await prisma.room.findMany({
            orderBy: { createdAt: 'desc' },
            include: { owner: { select: { name: true, email: true } } }
        });
        res.json(rooms);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

router.delete('/rooms/:id', async (req: AuthRequest, res) => {
    try {
        const id = Number(req.params.id);
        await prisma.room.delete({ where: { id } });

        // Realtime broadcast (Global)
        getIO().emit('roomDeleted', { id });
        getIO().emit('notificationsUpdated');

        // Log
        const admin = await prisma.user.findUnique({ where: { id: req.user!.id } });
        await logAdminAction(req.user!.id, admin?.name || 'Admin', 'DELETE_ROOM', `Deleted room ID: ${id}`, String(id));

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Ban User
router.post('/users/:id/ban', async (req: AuthRequest, res) => {
    try {
        const id = Number(req.params.id);
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Multi-level ban: Block account AND record email for permanent blockage
        await prisma.$transaction([
            prisma.user.update({ where: { id }, data: { isBanned: true } }),
            prisma.bannedEmail.upsert({
                where: { email: user.email },
                create: { email: user.email, reason: 'Manual Admin Ban' },
                update: { email: user.email }
            })
        ]);

        // Realtime enforcement
        getIO().to(`user_${id}`).emit('accountBanned');
        getIO().emit('userStatusChanged_Admin', { userId: id, isBanned: true });

        // Log
        const admin = await prisma.user.findUnique({ where: { id: req.user!.id } });
        await logAdminAction(req.user!.id, admin?.name || 'Admin', 'BAN_USER', `Banned user: ${user.name} (${user.email})`, String(id));

        res.json({ success: true, message: 'User banned permanently and email blacklisted' });
    } catch (e) {
        res.status(500).json({ error: 'Ban operation failed' });
    }
});

// Unban User
router.post('/users/:id/unban', async (req: AuthRequest, res) => {
    try {
        const id = Number(req.params.id);
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        await prisma.$transaction([
            prisma.user.update({ where: { id }, data: { isBanned: false } }),
            prisma.bannedEmail.deleteMany({ where: { email: user.email } })
        ]);

        // Realtime enforcement
        getIO().to(`user_${id}`).emit('accountUnbanned');
        getIO().emit('userStatusChanged_Admin', { userId: id, isBanned: false });

        // Log
        const admin = await prisma.user.findUnique({ where: { id: req.user!.id } });
        await logAdminAction(req.user!.id, admin?.name || 'Admin', 'UNBAN_USER', `Restored access for: ${user.name} (${user.email})`, String(id));

        res.json({ success: true, message: 'User access restored' });
    } catch (e) {
        res.status(500).json({ error: 'Unban operation failed' });
    }
});

// Get Admin Logs
router.get('/logs', async (req: AuthRequest, res: Response) => {
    try {
        const logs = await prisma.adminLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 200 // Recent 200 logs
        });
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Admin Management (Super Admin only)
router.get('/team', async (req: AuthRequest, res: Response) => {
    try {
        const team = await prisma.user.findMany({
            where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
            select: { id: true, name: true, email: true, role: true, designation: true, phoneNumber: true, isBanned: true }
        });
        res.json(team);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

import bcrypt from 'bcryptjs';

router.post('/create-subadmin', async (req: AuthRequest, res: Response) => {
    try {
        const adminId = req.user!.id;
        const manager = await prisma.user.findUnique({ where: { id: adminId } });
        if (manager?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Unauthorized: Only Super Admin can create sub-admins.' });
        }

        const { name, email, password, phoneNumber, designation, role } = req.body;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(400).json({ error: 'Email exists' });

        const hashed = await bcrypt.hash(password, 10);
        const newAdmin = await prisma.user.create({
            data: {
                name,
                email,
                password: hashed,
                phoneNumber,
                designation,
                role: role || 'ADMIN'
            }
        });

        await logAdminAction(adminId, manager.name, 'CREATE_ADMIN', `Created new sub-admin: ${name} (${email})`, String(newAdmin.id));

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

import { getReports, handleReportAction } from '../controllers/reportController';

router.get('/reports', getReports);
router.post('/reports/:id/action', handleReportAction);

export default router;
