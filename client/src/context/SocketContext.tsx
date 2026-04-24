import React, { createContext, useContext, useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
    socket: Socket | null;
    isOnline: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isOnline, setIsOnline] = useState(false);

    useEffect(() => {
        const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        const socketUrl = isProduction 
            ? `https://${window.location.hostname}` 
            : `http://${window.location.hostname}:3000`;

        // Always connect even for guests, but pass userId if present
        const newSocket = io(socketUrl, {
            query: user ? { userId: user.id } : {},
            transports: ['websocket', 'polling'], // Support both
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        });

        newSocket.on('connect', () => {
            console.log('Socket connected');
            setIsOnline(true);
        });

        newSocket.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsOnline(false);
        });

        setSocket(newSocket);

        newSocket.on('accountBanned', () => {
            window.location.href = '/banned';
        });

        newSocket.on('accountUnbanned', () => {
            window.location.href = '/login';
        });

        return () => {
            console.log('Cleaning up socket...');
            newSocket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]); // Reconnect if user login/logout to update query params

    return (
        <SocketContext.Provider value={{ socket, isOnline }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (context === undefined) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};
