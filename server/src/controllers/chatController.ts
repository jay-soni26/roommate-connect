import { Response } from 'express';
import { prisma } from '../utils';
import { AuthRequest } from '../middleware/auth';
import { getIO } from '../socket';

export const getConversations = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        // Find chats where user is a participant
        const chats = await prisma.chat.findMany({
            where: {
                participants: {
                    some: {
                        id: userId,
                    },
                },
            },
            include: {
                participants: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                        isOnline: true,
                        lastSeen: true,
                        profile: {
                            select: {
                                occupation: true,
                                avatar: true,
                                showAvatarPublicly: true
                            }
                        }
                    },
                },
                messages: {
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                },
                _count: {
                    select: {
                        messages: {
                            where: { isRead: false, senderId: { not: userId } }
                        }
                    }
                }
            },
            orderBy: { updatedAt: 'desc' },
        });
        res.json(chats);
    } catch (error) {
        console.error('getConversations error:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
    try {
        const { chatId } = req.params;
        const userId = req.user!.id;
        const messages = await prisma.message.findMany({
            where: {
                chatId: Number(chatId),
                NOT: [
                    { AND: [{ senderId: userId }, { deletedBySender: true }] },
                    { AND: [{ senderId: { not: userId } }, { deletedByRecipient: true }] }
                ]
            },
            include: { sender: { select: { id: true, name: true, role: true } } },
            orderBy: { createdAt: 'asc' },
        });
        res.json(messages);
    } catch (error) {
        console.error('getMessages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};

export const startChat = async (req: AuthRequest, res: Response) => {
    try {
        const { partnerId } = req.body;
        const userId = req.user!.id;

        const partnerIdNum = Number(partnerId);

        if (isNaN(partnerIdNum)) return res.status(400).json({ error: 'Invalid partnerId' });
        if (userId === partnerIdNum) return res.status(400).json({ error: 'Cannot chat with yourself' });

        const [currentUser, partner] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId } }),
            prisma.user.findUnique({ where: { id: partnerIdNum } })
        ]);

        if (currentUser?.isBanned) {
            // Banned user can ONLY start chat with SUPER_ADMIN
            if (partner?.role !== 'SUPER_ADMIN') {
                return res.status(403).json({ error: 'Banned users can only contact Super Admin for appeals.' });
            }
        }

        if (partner?.isBanned && currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'This user has been restricted and cannot be contacted.' });
        }

        // Check if chat already exists
        const existingChat = await prisma.chat.findFirst({
            where: {
                AND: [
                    { participants: { some: { id: userId } } },
                    { participants: { some: { id: partnerIdNum } } },
                ],
            },
        });

        if (existingChat) return res.json(existingChat);

        const chat = await prisma.chat.create({
            data: {
                participants: {
                    connect: [{ id: userId }, { id: partnerIdNum }],
                },
            },
            include: {
                participants: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                        isOnline: true,
                        lastSeen: true,
                        profile: {
                            select: {
                                avatar: true,
                                showAvatarPublicly: true
                            }
                        }
                    }
                },
                messages: true
            }
        });

        // Notify partner that a new chat has started
        const io = getIO();
        io.to(`user_${partnerIdNum}`).emit('chatStarted', chat);

        res.status(201).json(chat);
    } catch (error) {
        console.error('startChat error:', error);
        res.status(500).json({ error: 'Failed to start chat' });
    }
};

export const getChatDetails = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const chatId = Number(req.params.chatId);

        if (isNaN(chatId)) return res.status(400).json({ error: 'Invalid chat ID' });

        const chat = await prisma.chat.findFirst({
            where: {
                id: chatId,
                participants: {
                    some: {
                        id: userId
                    }
                }
            },
            include: {
                participants: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                        isOnline: true,
                        lastSeen: true,
                        profile: {
                            select: {
                                occupation: true,
                                avatar: true,
                                showAvatarPublicly: true
                            }
                        }
                    },
                },
                messages: {
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                },
                _count: {
                    select: {
                        messages: {
                            where: { isRead: false, senderId: { not: userId } }
                        }
                    }
                }
            },
        });

        if (!chat) return res.status(404).json({ error: 'Chat not found' });

        res.json(chat);
    } catch (error) {
        console.error('getChatDetails error:', error);
        res.status(500).json({ error: 'Failed to fetch chat details' });
    }
};
