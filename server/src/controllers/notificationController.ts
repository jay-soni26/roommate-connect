import { Response } from 'express';
import { prisma } from '../utils';
import { AuthRequest } from '../middleware/auth';
import { sendPushNotification } from '../utils/push';
import { isUserOnline } from '../socket';

export const checkProfileCompletion = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // Fetch user with received flag and profile
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        // If they've already received it, we strictly never show it again
        if ((user as any).hasReceivedProfileNotif) {
            return res.json({ message: 'Notification already triggered/handled in the past.' });
        }

        // Check if profile is incomplete OR room preferences (budget, location, etc) are missing
        const isComplete = user.profile &&
            user.profile.state &&
            user.profile.city &&
            user.profile.gender &&
            user.phoneNumber &&
            user.profile.budgetMin &&
            user.profile.budgetMax;

        if (!isComplete) {
            // Trigger ONE notification
            await prisma.notification.create({
                data: {
                    userId,
                    type: 'PROFILE_COMPLETION',
                    title: 'Complete Your Profile',
                    message: 'Please complete your profile and room preferences to get better matches.',
                    isRead: false
                }
            });

            // Push Notification - ONLY IF OFFLINE
            if (!isUserOnline(userId)) {
                const subs = await prisma.pushSubscription.findMany({ where: { userId } });
                for (const sub of subs) {
                    await sendPushNotification(sub, {
                        title: 'Complete Your Profile',
                        body: 'Please complete your profile and room preferences to get better matches.',
                        url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/profile`
                    });
                }
            }

            // Mark as received FOREVER
            await prisma.user.update({
                where: { id: userId },
                data: { hasReceivedProfileNotif: true } as any
            });

            return res.json({ triggered: true });
        }

        res.json({ triggered: false });
    } catch (error) {
        console.error('checkProfileCompletion error:', error);
        res.status(500).json({ error: 'Failed to check profile completion' });
    }
};

// Chat notification functions
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // Count unread messages across all chats
        const unreadCount = await prisma.message.count({
            where: {
                isRead: false,
                senderId: { not: userId },
                chat: {
                    participants: {
                        some: {
                            id: userId
                        }
                    }
                }
            }
        });

        res.json({ count: unreadCount });
    } catch (error) {
        console.error('getUnreadCount error:', error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { chatId } = req.params;

        // Mark all messages in this chat as read (except sender's own messages)
        await prisma.message.updateMany({
            where: {
                chatId: Number(chatId),
                senderId: { not: userId },
                isRead: false
            },
            data: {
                isRead: true
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('markAsRead error:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
};

// System/Listing notification functions
export const getNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const notifications = await prisma.notification.findMany({
            where: {
                userId
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json(notifications);
    } catch (error) {
        console.error('getNotifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

export const getUnreadNotificationCount = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const count = await prisma.notification.count({
            where: {
                userId,
                isRead: false
            }
        });

        res.json({ count });
    } catch (error) {
        console.error('getUnreadNotificationCount error:', error);
        res.status(500).json({ error: 'Failed to fetch unread notification count' });
    }
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        // Verify the notification belongs to this user
        const notification = await prisma.notification.findFirst({
            where: {
                id: Number(id),
                userId
            }
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        // Mark as read
        await prisma.notification.update({
            where: {
                id: Number(id)
            },
            data: {
                isRead: true
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('markNotificationRead error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
};

export const deleteNotification = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        await prisma.notification.delete({
            where: { id: Number(id), userId }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
};

export const bulkDeleteNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { ids } = req.body; // Array of IDs

        await prisma.notification.deleteMany({
            where: {
                id: { in: ids.map((id: any) => Number(id)) },
                userId
            }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
};
