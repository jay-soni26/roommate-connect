import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getIO } from '../socket';
import { z } from 'zod';

const roomBaseSchema = z.object({
    postingType: z.enum(['SEEKING', 'OFFERING']).default('OFFERING'),
    title: z.string().min(5, "Title must be at least 5 characters"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    location: z.string().min(2, "Area/Neighborhood is required"),
    state: z.string().min(1, "State is required"),
    city: z.string().min(1, "City is required"),
    address: z.string().min(5, "Full address is required"),
    rentPerPerson: z.coerce.number().int().min(1, "Rent/Budget must be at least 1"),
    capacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),
    currentOccupancy: z.coerce.number().int().min(0, "Occupancy cannot be negative").default(0),
    propertyType: z.string().nullable().optional(),
    furnishing: z.string().nullable().optional(),
    amenities: z.string().nullable().optional(),
    genderPreference: z.string().nullable().optional(),
    lookingFor: z.string().nullable().optional(),
    images: z.string().nullable().optional(),
});

const createRoomSchema = roomBaseSchema.refine(data => {
    if (data.postingType === 'OFFERING' && data.currentOccupancy !== undefined && data.capacity !== undefined) {
        return data.currentOccupancy <= data.capacity;
    }
    return true;
}, {
    message: "Occupancy cannot exceed capacity",
    path: ["currentOccupancy"]
});

interface AuthRequest extends Request {
    user?: { id: number; role: string };
}

export const createRoom = async (req: AuthRequest, res: Response) => {
    try {
        console.log('createRoom called');

        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user?.isBanned) {
            return res.status(403).json({ error: 'Your account is restricted. You cannot create new listings.' });
        }

        const data = createRoomSchema.parse(req.body);

        const room = await prisma.room.create({
            data: {
                postingType: data.postingType as any,
                title: data.title,
                description: data.description,
                location: data.location,
                state: data.state,
                city: data.city,
                address: data.address,
                rentPerPerson: data.rentPerPerson,
                capacity: data.capacity,
                currentOccupancy: data.currentOccupancy,
                propertyType: data.propertyType,
                furnishing: data.furnishing,
                amenities: data.amenities,
                genderPreference: data.genderPreference,
                lookingFor: data.lookingFor,
                images: data.images,
                ownerId: req.user.id,
            } as any,
        });

        console.log('Room created successfully:', room);

        // Fetch the room with owner details to emit to everyone
        const fullRoom = await prisma.room.findUnique({
            where: { id: room.id },
            include: { owner: { select: { name: true, email: true } } },
        });

        // Emit real-time event
        getIO().emit('roomCreated', fullRoom);

        // Notification Logic for OFFERING posts
        // Find users whose preferences match this new room
        if (room.postingType === 'OFFERING') {
            const matchingProfiles = await prisma.profile.findMany({
                where: {
                    userId: { not: req.user.id }, // Don't notify the poster
                    OR: [
                        { city: (room as any).city },
                        { state: (room as any).state }
                    ],
                    // Budget Check: Their max budget >= Room rent
                    budgetMax: { gte: room.rentPerPerson }
                },
                select: { userId: true }
            });

            if (matchingProfiles.length > 0) {
                const notificationsData = matchingProfiles.map(p => ({
                    userId: p.userId,
                    type: 'ROOM_MATCH',
                    title: 'New Room Match!',
                    message: `A new room in ${(room as any).city} matches your preferences.`,
                    data: JSON.stringify({ roomId: room.id }),
                    isRead: false
                }));

                await (prisma as any).notification.createMany({
                    data: notificationsData
                });

                // Real-time notification push
                matchingProfiles.forEach(p => {
                    if ((req as any).io) {
                        (req as any).io.to(`user_${p.userId}`).emit('newNotification', {
                            title: 'New Room Match!',
                            message: `A new room in ${(room as any).city} matches your preferences.`,
                            data: JSON.stringify({ roomId: room.id })
                        });
                    }
                });
            }
        }

        res.status(201).json(room);
    } catch (error: any) {
        console.error('Room creation error:', error);
        console.error('Error name:', error.name);
        console.error('Error issues:', error.issues);

        // Zod errors have an 'issues' property
        if (error.issues) {
            const errorMessages = error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ');
            return res.status(400).json({
                error: 'Validation failed',
                details: error.issues,
                message: errorMessages
            });
        }

        if (error.name === 'ZodError') {
            const errorMessages = error.issues ? error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ') : 'Please check all fields';
            return res.status(400).json({
                error: 'Validation failed',
                details: error.errors || error.issues,
                message: errorMessages
            });
        }

        res.status(400).json({
            error: 'Failed to create room',
            details: error.message || String(error),
            message: error.message || 'An unexpected error occurred'
        });
    }
};

import jwt from 'jsonwebtoken';

export const getRooms = async (req: Request, res: Response) => {
    try {
        const { location, maxRent, gender, page = '1', limit = '50' } = req.query;
        const p = Math.max(1, Number(page));
        const l = Math.min(100, Number(limit));

        const where: any = {};
        if (location) where.location = { contains: String(location) };
        if (maxRent) where.rentPerPerson = { lte: Number(maxRent) };
        if (gender) where.genderPreference = String(gender);

        // Filter out rooms from banned users
        where.owner = { isBanned: false };

        const roomIdsFavorited = new Set<number>();
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        let currentUserId: number | null = null;

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'roommate_connect_secret_key_2026') as any;
                if (decoded && decoded.id) {
                    currentUserId = decoded.id;
                    where.ownerId = { not: decoded.id };

                    // Fetch current user's favorite IDs
                    const userFavorites = await prisma.favorite.findMany({
                        where: { userId: decoded.id },
                        select: { roomId: true }
                    });
                    userFavorites.forEach(f => roomIdsFavorited.add(f.roomId));
                }
            } catch (e) {
                // Ignore invalid tokens for public room list
            }
        }

        const [rooms, total] = await Promise.all([
            prisma.room.findMany({
                where,
                include: { 
                    owner: { 
                        select: { name: true, email: true, isOnline: true } 
                    } 
                },
                orderBy: { createdAt: 'desc' },
                skip: (p - 1) * l,
                take: l,
            }),
            prisma.room.count({ where })
        ]);

        // Enrich with isFavorited status
        const enrichedRooms = rooms.map(room => ({
            ...room,
            isFavorited: roomIdsFavorited.has(room.id)
        }));

        res.json({
            data: enrichedRooms,
            pagination: {
                total,
                page: p,
                limit: l,
                totalPages: Math.ceil(total / l)
            }
        });
    } catch (error: any) {
        console.error('getRooms error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

export const getMyRooms = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const rooms = await prisma.room.findMany({
            where: { ownerId: userId },
            include: { owner: { select: { name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch my rooms' });
    }
};

export const getRoomById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const room = await prisma.room.findUnique({
            where: { id: Number(id) },
            include: { owner: { select: { name: true, email: true, isBanned: true } } },
        });

        if (!room) return res.status(404).json({ error: 'Room not found' });

        let userId = null;
        let role = null;
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            try {
                const secret = process.env.JWT_SECRET || 'secret';
                const decoded = jwt.verify(token, secret) as any;
                userId = decoded.id;
                role = decoded.role;
            } catch (e) {}
        }

        if (room.owner.isBanned && room.ownerId !== userId && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'This listing is no longer available.' });
        }

        let isFavorited = false;
        if (userId) {
            const fav = await prisma.favorite.findUnique({
                where: { userId_roomId: { userId, roomId: Number(id) } }
            });
            isFavorited = !!fav;
        }

        res.json({ ...room, isFavorited });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch room' });
    }
};

export const deleteRoom = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const room = await prisma.room.findUnique({ where: { id: Number(id) } });

        if (!room) return res.status(404).json({ error: 'Room not found' });
        if (room.ownerId !== userId && req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await prisma.room.delete({ where: { id: Number(id) } });

        // Remove all related notifications permanently
        await (prisma as any).notification.deleteMany({
            where: {
                data: {
                    contains: `"roomId":${id}`
                }
            }
        });

        // Emit real-time event for deletion (Global)
        getIO().emit('roomDeleted', { id: Number(id) });
        getIO().emit('notificationsUpdated'); 


        res.json({ message: 'Room deleted successfully' });
    } catch (error: any) {
        console.error('Room deletion error:', error);
        res.status(500).json({ error: 'Failed to delete room', details: error.message || error });
    }
};

export const updateRoom = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const room = await prisma.room.findUnique({ 
            where: { id: Number(id) },
            include: { owner: { select: { isBanned: true } } } 
        });

        if (!room) return res.status(404).json({ error: 'Room not found' });
        if (room.owner.isBanned) return res.status(403).json({ error: 'Your account is restricted. You cannot edit listings.' });
        if (room.ownerId !== userId && req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Validate partial update using the base schema (refinements prevent .partial())
        const data = roomBaseSchema.partial().parse(req.body);

        // Explicit logical check for updates combining new and existing values
        const finalCapacity = data.capacity ?? room.capacity;
        const finalOccupancy = data.currentOccupancy ?? room.currentOccupancy;
        const finalPostingType = data.postingType ?? (room as any).postingType;

        if (finalPostingType === 'OFFERING' && finalOccupancy > finalCapacity) {
            return res.status(400).json({
                error: 'Validation failed',
                details: [{ path: ['currentOccupancy'], message: `Occupancy (${finalOccupancy}) cannot exceed capacity (${finalCapacity})` }]
            });
        }

        const updatedRoom = await prisma.room.update({
            where: { id: Number(id) },
            data: data as any,
            include: { owner: { select: { name: true, email: true } } }
        });

        // Emit real-time event for update
        if ((req as any).io) {
            (req as any).io.emit('roomUpdated', updatedRoom);
        }

        res.json(updatedRoom);
    } catch (error: any) {
        console.error('Room update error:', error);

        if (error.issues) {
            const errorMessages = error.issues.map((i: any) => i.message).join(', ');
            return res.status(400).json({
                error: 'Validation failed',
                details: error.issues,
                message: errorMessages
            });
        }

        res.status(400).json({
            error: 'Failed to update room',
            details: error.message || 'An unexpected error occurred',
            message: error.message
        });
    }
};

export const toggleFavorite = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { roomId } = req.body;

        if (!roomId) return res.status(400).json({ error: 'Room ID is required' });

        const existing = await prisma.favorite.findUnique({
            where: { userId_roomId: { userId, roomId: Number(roomId) } }
        });

        if (existing) {
            await prisma.favorite.delete({
                where: { id: existing.id }
            });
            return res.json({ success: true, action: 'removed', message: 'Removed from favorites' });
        } else {
            await prisma.favorite.create({
                data: { userId, roomId: Number(roomId) }
            });
            return res.json({ success: true, action: 'added', message: 'Added to favorites' });
        }
    } catch (error) {
        console.error('toggleFavorite error:', error);
        res.status(500).json({ error: 'Failed to toggle favorite' });
    }
};

export const getFavorites = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const favorites = await prisma.favorite.findMany({
            where: { userId },
            include: {
                room: {
                    include: {
                        owner: { select: { name: true, email: true, isOnline: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Map to return just the room objects with isFavorited: true
        const rooms = favorites.map(f => ({
            ...f.room,
            isFavorited: true
        }));

        res.json(rooms);
    } catch (error) {
        console.error('getFavorites error:', error);
        res.status(500).json({ error: 'Failed to fetch favorites' });
    }
};

