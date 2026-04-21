import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

interface NotificationContextType {
    unreadCount: number;
    refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const { user } = useAuth();
    const { socket } = useSocket();

    const refreshUnreadCount = useCallback(async () => {
        if (!user) return;
        try {
            const { data } = await api.get('/notifications/unread-count');
            setUnreadCount(data.count);
        } catch (error) {
            console.error('Failed to fetch unread count', error);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            refreshUnreadCount();
        } else {
            setUnreadCount(0);
        }
    }, [user, refreshUnreadCount]);

    useEffect(() => {
        if (!socket) return;

        const handleUpdate = () => {
            refreshUnreadCount();
        };

        socket.on('newMessage', handleUpdate);
        socket.on('messagesRead', handleUpdate);
        socket.on('notification', handleUpdate);

        return () => {
            socket.off('newMessage', handleUpdate);
            socket.off('messagesRead', handleUpdate);
            socket.off('notification', handleUpdate);
        };
    }, [socket, refreshUnreadCount]);

    return (
        <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
