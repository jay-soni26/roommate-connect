import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer;
const userSockets = new Map<number, Set<string>>();

export const initSocket = (httpServer: HTTPServer, corsOptions: any): SocketIOServer => {
    io = new SocketIOServer(httpServer, {
        cors: { ...corsOptions, methods: ["GET", "POST"] }
    });
    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

// Tracking user presence
export const addUserSocket = (userId: number, socketId: string) => {
    if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socketId);
    return userSockets.get(userId)!.size;
};

export const removeUserSocket = (userId: number, socketId: string) => {
    if (userSockets.has(userId)) {
        const sockets = userSockets.get(userId)!;
        sockets.delete(socketId);
        if (sockets.size === 0) {
            userSockets.delete(userId);
            return 0;
        }
        return sockets.size;
    }
    return 0;
};

export const isUserOnline = (userId: number): boolean => {
    const sockets = userSockets.get(userId);
    return !!sockets && sockets.size > 0;
};

export const getRecipientSockets = (userId: number): string[] => {
    const sockets = userSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
};
