import { Request, Response } from 'express';
import { prisma } from '../utils';
import { AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const profileSchema = z.object({
    // User fields
    name: z.string().optional(),
    phoneNumber: z.string().optional(),

    // Profile fields
    budgetMin: z.coerce.number().optional().nullable(),
    budgetMax: z.coerce.number().optional().nullable(),
    location: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    occupation: z.string().optional(),
    gender: z.string().optional(),
    lifestyle: z.string().optional(),
    bio: z.string().optional(),
    address: z.string().optional(),
    preferredRoomType: z.string().optional(),
    avatar: z.string().optional(),
    showAvatarPublicly: z.boolean().optional(),
});

export const getProfile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = Number(req.params.userId || req.user?.id);
        const profile = await prisma.profile.findUnique({
            where: { userId },
            include: { user: { select: { name: true, email: true, role: true, phoneNumber: true } as any } },
        });

        // If profile doesn't exist yet, return empty profile structure with user info
        if (!profile) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true, email: true, role: true, phoneNumber: true } as any
            });
            return res.json({ user, budgetMin: null, budgetMax: null, location: '', occupation: '', gender: '', address: '', preferredRoomType: '' });
        }

        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const validatedData = profileSchema.parse(req.body);

        // Separate user fields from profile fields
        const { name, phoneNumber, ...profileData } = validatedData;

        // Update User info if provided
        if (name || phoneNumber) {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    ...(name && { name }),
                    ...(phoneNumber && { phoneNumber }),
                }
            });
        }

        // Upsert Profile info
        const profile = await prisma.profile.upsert({
            where: { userId },
            update: profileData,
            create: { ...profileData, userId },
        });

        res.json({ message: 'Profile updated successfully', profile });

        // Emit real-time for name/phone updates if they changed
        if ((req as any).io) {
            (req as any).io.emit('profileUpdated', {
                userId,
                name,
                phoneNumber,
                avatar: profileData.avatar,
                showAvatarPublicly: profileData.showAvatarPublicly
            });
        }

        // Check for 100% completion to delete the one-time notification
        const completeUser = await prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true }
        });

        if (completeUser && completeUser.profile) {
            const isNowComplete = completeUser.profile.state &&
                completeUser.profile.city &&
                completeUser.profile.gender &&
                completeUser.phoneNumber &&
                completeUser.profile.budgetMin &&
                completeUser.profile.budgetMax;

            if (isNowComplete) {
                // Delete the profile completion notification permanently
                await prisma.notification.deleteMany({
                    where: {
                        userId,
                        type: 'PROFILE_COMPLETION'
                    }
                });
            }
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues[0].message });
        }
        res.status(400).json({ error: 'Failed to update profile' });
    }
};

export const findRoommates = async (req: Request, res: Response) => {
    try {
        const { location, gender, minBudget, maxBudget } = req.query;

        const where: any = {};
        if (location) where.location = { contains: String(location) };
        if (gender) where.gender = String(gender);
        if (minBudget) where.budgetMax = { gte: Number(minBudget) }; // Their max budget must be >= my min budget
        // Complicated logic for overlapping ranges, keeping it simple for MVP:
        // Match if their budget range overlaps with query?
        // Let's just filter by exact location match or something simple first.

        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            try {
                const secret = process.env.JWT_SECRET as string;
                import('jsonwebtoken').then(jwt => {
                    const user = jwt.verify(token, secret) as any;
                    if (user && user.id) {
                        (where as any).userId = { not: user.id };
                    }
                });
            } catch (e) {}
        }

        // Banned users should not be able to view others and should not be seen
        if (token) {
             const secret = process.env.JWT_SECRET as string;
             const jwt = require('jsonwebtoken');
             try {
                const user = jwt.verify(token, secret) as any;
                if (user && user.id) {
                    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { isBanned: true } });
                    if (dbUser?.isBanned) {
                        return res.status(403).json({ error: 'Your account has been restricted. You cannot view roommates.' });
                    }
                    (where as any).userId = { not: user.id };
                }
             } catch (e) {}
        }

        (where as any).user = { isBanned: false };

        const profiles = await prisma.profile.findMany({
            where,
            include: { user: { select: { name: true, email: true } } },
        });

        res.json(profiles);
    } catch (error) {
        res.status(500).json({ error: 'Failed to find roommates' });
    }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user!.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Please provide both current and new passwords' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isMatch = await bcrypt.compare(String(currentPassword), user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Incorrect current password' });
        }

        const hashedPassword = await bcrypt.hash(String(newPassword), 10);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
};

export const deleteAccount = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // In a real app with many relations, we might want to use a transaction
        // Clean up everything associated
        await prisma.favorite.deleteMany({ where: { userId } });
        await prisma.report.deleteMany({ where: { OR: [{ reporterId: userId }, { reportedUserId: userId }] } });
        await prisma.pushSubscription.deleteMany({ where: { userId } });
        await prisma.notification.deleteMany({ where: { userId } });
        await prisma.profile.deleteMany({ where: { userId } });
        await prisma.room.deleteMany({ where: { ownerId: userId } });
        await prisma.message.deleteMany({ where: { senderId: userId } });
        
        // Delete user
        // NOTE: We do NOT delete the email from BannedEmail. 
        // This ensures if they were banned, deleting/re-registering still blocks them.
        await prisma.user.delete({ where: { id: userId } });

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
};

export const getSuperAdmin = async (req: Request, res: Response) => {
    try {
        const superAdmin = await prisma.user.findFirst({
            where: { role: 'SUPER_ADMIN' },
            select: { id: true, name: true }
        });
        if (!superAdmin) return res.status(404).json({ error: 'System admin not found' });
        res.json(superAdmin);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};
