import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initSocket, addUserSocket, removeUserSocket, isUserOnline, getRecipientSockets } from './socket';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const corsOptions = {
    origin: function (origin: any, callback: any) {
        // Allow all local dev origins
        callback(null, true);
    },
    credentials: true,
};

const io = initSocket(httpServer, corsOptions);

import authRoutes from './routes/auth';

app.use(cors(corsOptions));
app.use(express.json());

// Attach Socket.io to request object
app.use((req, res, next) => {
    (req as any).io = io;
    next();
});

app.use('/uploads', express.static('uploads')); // Serve uploaded images

import roomRoutes from './routes/rooms';
import userRoutes from './routes/users';
import chatRoutes from './routes/chat';
import notificationRoutes from './routes/notifications';
import uploadRoutes from './routes/upload';
import adminRoutes from './routes/admin';
import { prisma } from './utils';

import reportRoutes from './routes/reports';
import pushRoutes from './routes/push';
import { sendPushNotification } from './utils/push';

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/push', pushRoutes);

// Reset all users to offline on start (cleanup ghost connections)
prisma.user.updateMany({
    data: { isOnline: false }
}).catch(e => console.error("Cleanup error:", e));

app.get('/', (req, res) => {
    res.send('Roommate Connect API is running');
});

// Presence tracking is now handled by src/socket.ts helpers

io.on('connection', (socket) => {
    const userId = Number(socket.handshake.query.userId);
    if (userId) {
        const count = addUserSocket(userId, socket.id);

        // Update presence only if this is the first connection
        if (count === 1) {
            prisma.user.update({
                where: { id: userId },
                data: { isOnline: true, lastSeen: new Date() }
            }).then(async () => {
                io.emit('userStatusChanged', { userId, isOnline: true, lastSeen: new Date() });

                // Mark pending messages as delivered
                try {
                    const undeliveredMessages = await prisma.message.findMany({
                        where: {
                            chat: { participants: { some: { id: userId } } }, // In chats where user is participant
                            senderId: { not: userId }, // Sent by others
                            isDelivered: false,
                            isRead: false
                        }
                    });

                    if (undeliveredMessages.length > 0) {
                        const msgIds = undeliveredMessages.map(m => m.id);
                        await prisma.message.updateMany({
                            where: { id: { in: msgIds } },
                            data: { isDelivered: true }
                        });

                        // Notify senders
                        undeliveredMessages.forEach(msg => {
                            const senderSockets = getRecipientSockets(msg.senderId);
                            if (senderSockets.length > 0) {
                                senderSockets.forEach(sId => io.to(sId).emit('messageDelivered', { messageId: msg.id, chatId: msg.chatId }));
                            }
                        });
                    }
                } catch (err) {
                    console.error("Delivery update error:", err);
                }

            }).catch(e => console.error("Presence update error:", e));
        }

        // Join personal notification channel
        socket.join(`user_${userId}`);
    }

    socket.on('sendMessage', async ({ chatId, senderId, content, recipientId, imageUrl, isViewOnce }) => {
        try {
            // BACKEND SECURITY: Check if sender is banned
            const sender = await prisma.user.findUnique({ where: { id: senderId } });
            if (sender?.isBanned) {
                // Determine if recipient is Super Admin
                const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
                if (recipient?.role !== 'SUPER_ADMIN') {
                    socket.emit('error', { message: 'Banned accounts can only message Support.' });
                    return;
                }
            }

            // Emit to all recipient's sockets if online
            const recipientSockets = getRecipientSockets(recipientId);
            const isOnline = recipientSockets.length > 0;

            // Save message to DB
            const message = await prisma.message.create({
                data: {
                    chatId,
                    senderId,
                    content,
                    imageUrl,
                    isViewOnce: !!isViewOnce,
                    isDelivered: !!isOnline,
                },
                include: { 
                    sender: { 
                        select: { name: true, role: true } 
                    } 
                }
            });

            // Rebrand Super Admin as "Official" for notifications
            const senderName = message.sender.role === 'SUPER_ADMIN' 
                ? 'RoommateConnect Official' 
                : message.sender.name;

            // Update Chat timestamp
            await prisma.chat.update({
                where: { id: chatId },
                data: { updatedAt: new Date() },
            });

            if (isOnline) {
                recipientSockets.forEach(sId => {
                    io.to(sId).emit('newMessage', message);
                });
            } else {
                // RECIPIENT IS OFFLINE: Send Push Notification (Background)
                prisma.pushSubscription.findMany({
                    where: { userId: recipientId }
                }).then(subscriptions => {
                    for (const sub of subscriptions) {
                        sendPushNotification(sub, {
                            title: `New Message from ${senderName}`,
                            body: message.content.length > 50 ? message.content.substring(0, 47) + '...' : message.content,
                            url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/chat` 
                        }).catch(e => console.error("Push send error:", e));
                    }
                }).catch(pushErr => {
                    console.error('Push subscription fetch failed:', pushErr);
                });
            }

            // Emit back to sender (all tabs)
            const senderSockets = getRecipientSockets(senderId);
            if (senderSockets.length > 0) {
                senderSockets.forEach(sId => {
                    io.to(sId).emit('messageSent', message);
                });
            }
        } catch (error) {
            console.error('Message failed:', error);
        }
    });

    socket.on('markViewOnceOpened', async ({ messageId, recipientId, senderId }) => {
        try {
            const message = await prisma.message.update({
                where: { id: messageId },
                data: { isViewed: true }
            });

            // Notify both parties that the message was viewed
            [senderId, recipientId].forEach(uId => {
                const sockets = getRecipientSockets(uId);
                if (sockets.length > 0) {
                    sockets.forEach(sId => {
                        io.to(sId).emit('messageViewed', { messageId });
                    });
                }
            });
        } catch (error) {
            console.error('View once update failed:', error);
        }
    });

    socket.on('unsendMessage', async ({ messageId, chatId, senderId, recipientId }) => {
        try {
            await prisma.message.update({
                where: { id: messageId },
                data: { isDeleted: true, content: 'This message was deleted', imageUrl: null }
            });

            // Notify both parties
            [senderId, recipientId].forEach(uId => {
                const sockets = getRecipientSockets(uId);
                if (sockets.length > 0) {
                    sockets.forEach(sId => {
                        io.to(sId).emit('messageUnsent', { messageId, chatId });
                    });
                }
            });
        } catch (error) {
            console.error('Unsend failed:', error);
        }
    });

    socket.on('deleteMessageForMe', async ({ messageId, chatId, userId }) => {
        try {
            const msg = await prisma.message.findUnique({ where: { id: messageId } });
            if (!msg) return;

            const updateData = msg.senderId === userId
                ? { deletedBySender: true }
                : { deletedByRecipient: true };

            await prisma.message.update({
                where: { id: messageId },
                data: updateData
            });

            // Notify only the user who deleted it (to update their UI)
            const sockets = getRecipientSockets(userId);
            if (sockets.length > 0) {
                sockets.forEach(sId => {
                    io.to(sId).emit('messageDeletedForMe', { messageId, chatId });
                });
            }
        } catch (error) {
            console.error('Delete for me failed:', error);
        }
    });

    socket.on('typing', ({ chatId, recipientId }) => {
        const sockets = getRecipientSockets(recipientId);
        if (sockets.length > 0) {
            sockets.forEach(sId => io.to(sId).emit('userTyping', { chatId }));
        }
    });

    socket.on('stopTyping', ({ chatId, recipientId }) => {
        const sockets = getRecipientSockets(recipientId);
        if (sockets.length > 0) {
            sockets.forEach(sId => io.to(sId).emit('userStoppedTyping', { chatId }));
        }
    });

    socket.on('markAsRead', async ({ chatId, userId, senderId }) => {
        try {
            // Update all unread messages in this chat sent by the partner
            await prisma.message.updateMany({
                where: {
                    chatId,
                    senderId,
                    isRead: false
                },
                data: { isRead: true, isDelivered: true }
            });

            // Notify the sender that their messages were read
            const senderSockets = getRecipientSockets(senderId);
            if (senderSockets.length > 0) {
                senderSockets.forEach(sId => io.to(sId).emit('messagesRead', { chatId }));
            }
        } catch (error) {
            console.error('Mark as read failed:', error);
        }
    });

    socket.on('markAsDelivered', async ({ messageId, senderId, chatId }) => {
        try {
            await prisma.message.update({
                where: { id: messageId },
                data: { isDelivered: true }
            });

            // Notify the sender that their message was delivered
            const senderSockets = getRecipientSockets(senderId);
            if (senderSockets.length > 0) {
                senderSockets.forEach(sId => io.to(sId).emit('messageDelivered', { messageId, chatId }));
            }
        } catch (error) {
            console.error('Mark as delivered failed:', error);
        }
    });

    socket.on('disconnect', () => {
        if (userId) {
            const count = removeUserSocket(userId, socket.id);

            if (count === 0) {
                const now = new Date();
                prisma.user.update({
                    where: { id: userId },
                    data: { isOnline: false, lastSeen: now }
                }).then(() => {
                    io.emit('userStatusChanged', { userId, isOnline: false, lastSeen: now });
                }).catch(e => console.error("Presence update error:", e));
            }
        } else {
            // console.log('Anonymous socket disconnected:', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
