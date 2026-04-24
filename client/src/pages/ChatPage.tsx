import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api, { API_BASE } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useSocket } from '../context/SocketContext';
import { Send, Smile, Image as ImageIcon, X, FileText, Download, Trash2, Eye, EyeOff, CheckCircle, Circle, Shield, MoreVertical, Flag } from 'lucide-react';

interface Message {
    id: number;
    content: string;
    imageUrl?: string;
    senderId: number;
    chatId: number;
    createdAt: string;
    sender: { name: string; role?: string };
    isViewOnce?: boolean;
    isViewed?: boolean;
    isDeleted?: boolean;
    isRead?: boolean;
    isDelivered?: boolean;
}

interface Chat {
    id: number;
    participants: { id: number; name: string, isOnline?: boolean, lastSeen?: string, role?: string, profile?: { avatar?: string, showAvatarPublicly?: boolean } }[];
    messages: Message[];
    _count?: {
        messages: number;
    };
}

const formatLastSeen = (dateString?: string) => {
    if (!dateString) return 'Offline';
    const lastSeen = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - lastSeen.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return lastSeen.toLocaleDateString();
};



const ChatPage: React.FC = () => {
    const { user, isBanned } = useAuth();
    const { socket } = useSocket();
    const location = useLocation();
    const { refreshUnreadCount } = useNotification();
    const [chats, setChats] = useState<Chat[]>([]);
    const [activeChat, setActiveChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isViewOnce, setIsViewOnce] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, messageId: number, isMe: boolean } | null>(null);
    const longPressTimer = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const activeChatRef = useRef<Chat | null>(null);
    const [typingUsers, setTypingUsers] = useState<Record<number, boolean>>({}); // chatId -> isTyping
    const [isLoadingChats, setIsLoadingChats] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const typingTimeoutRef = useRef<Record<number, any>>({});
    const [showChatMenu, setShowChatMenu] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason] = useState('VULGAR');
    const [reportEvidence, setReportEvidence] = useState('');
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);

    const emojis = ['😊', '😂', '🥰', '🔥', '👍', '🙌', '🎉', '❤️', '🤔', '😎', '💡', '✨'];

    // Sync ref with state
    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

    const fetchConversations = async (background = false) => {
        if (!background) setIsLoadingChats(true);
        try {
            const { data } = await api.get('/chats');
            setChats(data);

            if (location.state?.activeChatId && !background) {
                const targetChat = data.find((c: Chat) => c.id === location.state.activeChatId);
                if (targetChat) {
                    setActiveChat(targetChat);
                    setShowSidebar(false);
                }
            } else if (location.state?.partnerId && !background) {
                const targetChat = data.find((c: Chat) => c.participants.some(p => p.id === location.state.partnerId));
                if (targetChat) {
                    setActiveChat(targetChat);
                } else {
                    const newChatRes = await api.post('/chats/start', { partnerId: location.state.partnerId });
                    const refreshRes = await api.get('/chats');
                    setChats(refreshRes.data);
                    const newChat = refreshRes.data.find((c: Chat) => c.id === newChatRes.data.id);
                    if (newChat) {
                        setActiveChat(newChat);
                        setShowSidebar(false);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch chats');
        } finally {
            if (!background) setIsLoadingChats(false);
        }
    };

    // Fetch Conversations on mount or state change
    useEffect(() => {
        fetchConversations();
    }, [user, location.state]);

    // Setup Socket Listeners
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (msg: Message) => {
            const currentActiveChat = activeChatRef.current;

            // Case 1: Message is for the currently OPEN chat
            if (currentActiveChat && msg.chatId === currentActiveChat.id) {
                setMessages((prev) => {
                    // Deduplicate – socket can fire more than once
                    if (prev.some(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
                setTimeout(() => scrollToBottom(true), 100);

                // Mark read immediately
                api.post(`/notifications/mark-read/${currentActiveChat.id}`);
                const partner = currentActiveChat.participants.find(p => p.id === msg.senderId);
                if (partner && socket) {
                    socket.emit('markAsRead', {
                        chatId: currentActiveChat.id,
                        userId: user?.id,
                        senderId: partner.id
                    });
                }

                // Clear typing indicator
                setTypingUsers(prev => ({ ...prev, [msg.chatId]: false }));
                if (typingTimeoutRef.current[msg.chatId]) {
                    clearTimeout(typingTimeoutRef.current[msg.chatId]);
                    delete typingTimeoutRef.current[msg.chatId];
                }

                // Bring chat to top of list
                setChats(prev => {
                    const chatIndex = prev.findIndex(c => c.id === msg.chatId);
                    if (chatIndex === -1) return prev;
                    const updatedChat = { ...prev[chatIndex], messages: [msg] };
                    return [updatedChat, ...prev.filter(c => c.id !== msg.chatId)];
                });

            } else {
                // Case 2: Message is for a DIFFERENT chat (not currently open)
                // Mark delivered so sender gets double-tick
                if (socket) {
                    socket.emit('markAsDelivered', {
                        messageId: msg.id,
                        senderId: msg.senderId,
                        chatId: msg.chatId
                    });
                }

                // Update sidebar unread count and bring to top
                setChats(prev => {
                    const chatIndex = prev.findIndex(c => c.id === msg.chatId);
                    if (chatIndex === -1) {
                        // Unknown chat – fetch conversations and re-add message
                        fetchConversations(true).then(() => {
                            setChats(p => {
                                const newIdx = p.findIndex(c => c.id === msg.chatId);
                                if (newIdx !== -1) {
                                    const updated = {
                                        ...p[newIdx],
                                        messages: [msg],
                                        _count: { messages: (p[newIdx]._count?.messages || 0) + 1 }
                                    };
                                    return [updated, ...p.filter(c => c.id !== msg.chatId)];
                                }
                                return p;
                            });
                        });
                        return prev;
                    }
                    const updatedChat = {
                        ...prev[chatIndex],
                        _count: { messages: (prev[chatIndex]._count?.messages || 0) + 1 },
                        messages: [msg]
                    };
                    return [updatedChat, ...prev.filter(c => c.id !== msg.chatId)];
                });
                refreshUnreadCount();
            }
        };

        const handleMessageSent = (msg: Message) => {
            setMessages((prev) => {
                // Replace optimistic message with real one (deduplicate)
                const optimisticIndex = prev.findIndex(m => (m as any).isOptimistic && m.content === msg.content && m.chatId === msg.chatId);
                if (optimisticIndex !== -1) {
                    const updated = [...prev];
                    updated[optimisticIndex] = msg;
                    return updated;
                }
                // Also avoid true duplicates if socket fires twice
                if (prev.some(m => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
            setChats(prev => {
                const chatIndex = prev.findIndex(c => c.id === msg.chatId);
                if (chatIndex === -1) { fetchConversations(true); return prev; }
                const updatedChat = { ...prev[chatIndex], messages: [msg] };
                return [updatedChat, ...prev.filter(c => c.id !== msg.chatId)];
            });
        };

        const handleUserStatusChanged = ({ userId, isOnline, lastSeen }: { userId: number, isOnline: boolean, lastSeen: string }) => {
            setChats(prev => prev.map(chat => ({
                ...chat,
                participants: chat.participants.map(p =>
                    p.id === userId ? { ...p, isOnline, lastSeen } : p
                )
            })));

            setActiveChat(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    participants: prev.participants.map(p =>
                        p.id === userId ? { ...p, isOnline, lastSeen } : p
                    )
                };
            });
        };

        const handleProfileUpdated = (updatedData: any) => {
            const { userId, name, avatar, showAvatarPublicly } = updatedData;

            setChats(prev => prev.map(chat => ({
                ...chat,
                participants: chat.participants.map(p =>
                    p.id === userId ? {
                        ...p,
                        name: name || p.name,
                        profile: {
                            ...p.profile,
                            avatar: avatar !== undefined ? avatar : p.profile?.avatar,
                            showAvatarPublicly: showAvatarPublicly !== undefined ? showAvatarPublicly : p.profile?.showAvatarPublicly
                        }
                    } : p
                )
            })));

            setActiveChat(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    participants: prev.participants.map(p =>
                        p.id === userId ? {
                            ...p,
                            name: name || p.name,
                            profile: {
                                ...p.profile,
                                avatar: avatar !== undefined ? avatar : p.profile?.avatar,
                                showAvatarPublicly: showAvatarPublicly !== undefined ? showAvatarPublicly : p.profile?.showAvatarPublicly
                            }
                        } : p
                    )
                };
            });
        };

        const handleMessageViewed = ({ messageId }: { messageId: number }) => {
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, isViewed: true } : msg
            ));
        };

        const handleMessageUnsent = ({ messageId, chatId }: { messageId: number, chatId: number }) => {
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, isDeleted: true, content: 'This message was deleted', imageUrl: undefined } : msg
            ));
            setChats(prev => prev.map(chat =>
                chat.id === chatId ? { ...chat, messages: chat.messages.map(m => m.id === messageId ? { ...m, isDeleted: true, content: 'This message was deleted', imageUrl: undefined } : m) } : chat
            ));
        };

        const handleMessageDeletedForMe = ({ messageId }: { messageId: number }) => {
            setMessages(prev => prev.filter(msg => msg.id !== messageId));
        };

        socket.on('newMessage', handleNewMessage);
        socket.on('messageSent', handleMessageSent);
        socket.on('userStatusChanged', handleUserStatusChanged);
        socket.on('profileUpdated', handleProfileUpdated);
        socket.on('messageViewed', handleMessageViewed);
        socket.on('messageUnsent', handleMessageUnsent);
        socket.on('messageDeletedForMe', handleMessageDeletedForMe);
        
        socket.on('chatStarted', (newChat: Chat) => {
            setChats(prev => {
                if (prev.some(c => c.id === newChat.id)) return prev;
                return [newChat, ...prev];
            });
            toast.success(`New chat started with ${newChat.participants.find(p => p.id !== user?.id)?.name || 'someone'}`);
        });

        socket.on('userTyping', ({ chatId }: { chatId: number }) => {
            setTypingUsers(prev => ({ ...prev, [chatId]: true }));

            // Failsafe: Clear typing after 6 seconds of no updates
            if (typingTimeoutRef.current[chatId]) {
                clearTimeout(typingTimeoutRef.current[chatId]);
            }
            typingTimeoutRef.current[chatId] = setTimeout(() => {
                setTypingUsers(prev => ({ ...prev, [chatId]: false }));
            }, 6000);
        });

        socket.on('userStoppedTyping', ({ chatId }: { chatId: number }) => {
            setTypingUsers(prev => ({ ...prev, [chatId]: false }));
            if (typingTimeoutRef.current[chatId]) {
                clearTimeout(typingTimeoutRef.current[chatId]);
                delete typingTimeoutRef.current[chatId];
            }
        });

        socket.on('messagesRead', ({ chatId }: { chatId: number }) => {
            const currentActiveChat = activeChatRef.current;
            if (currentActiveChat && currentActiveChat.id === chatId) {
                // When partner reads, mark all my sent messages as read
                setMessages(prev => prev.map(m =>
                    m.senderId === user?.id ? { ...m, isRead: true, isDelivered: true } : m
                ));
            }
        });

        socket.on('messageDelivered', ({ messageId, chatId }: { messageId: number, chatId: number }) => {
            const currentActiveChat = activeChatRef.current;
            if (currentActiveChat && currentActiveChat.id === chatId) {
                setMessages(prev => prev.map(m =>
                    m.id === messageId ? { ...m, isDelivered: true } : m
                ));
            }
        });

        return () => {
            socket.off('newMessage', handleNewMessage);
            socket.off('messageSent', handleMessageSent);
            socket.off('userStatusChanged', handleUserStatusChanged);
            socket.off('profileUpdated', handleProfileUpdated);
            socket.off('messageViewed', handleMessageViewed);
            socket.off('messageUnsent', handleMessageUnsent);
            socket.off('messageDeletedForMe', handleMessageDeletedForMe);
            socket.off('chatStarted');
            socket.off('userTyping');
            socket.off('userStoppedTyping');
            socket.off('messagesRead');
            socket.off('messageDelivered');
        };
    }, [socket, user?.id, refreshUnreadCount]);

    const handleUnsend = (messageId: number) => {
        if (!socket || !activeChat || !user) return;
        const recipient = activeChat.participants.find(p => p.id !== user.id);
        if (!recipient) return;

        socket.emit('unsendMessage', {
            messageId,
            chatId: activeChat.id,
            senderId: user.id,
            recipientId: recipient.id
        });
        setContextMenu(null);
    };

    const handleDeleteForMe = (messageId: number) => {
        if (!socket || !activeChat || !user) return;
        socket.emit('deleteMessageForMe', {
            messageId,
            chatId: activeChat.id,
            userId: user.id
        });
        setContextMenu(null);
    };

    const handleContextMenu = (e: React.MouseEvent | React.TouchEvent, messageId: number, isMe: boolean) => {
        e.preventDefault();
        setContextMenu({ x: 0, y: 0, messageId, isMe });
    };

    const onTouchStart = (messageId: number, isMe: boolean) => (e: React.TouchEvent) => {
        // e.preventDefault(); // Don't prevent default immediately or it blocks clicking
        const event = { ...e }; // Capture event
        longPressTimer.current = window.setTimeout(() => {
            handleContextMenu(event, messageId, isMe);
        }, 500);
    };

    const onTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const toggleMessageSelection = (id: number) => {
        setSelectedMessageIds(prev =>
            prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = () => {
        if (!selectedMessageIds.length) return;
        if (!window.confirm(`Delete ${selectedMessageIds.length} selected messages only for you?`)) return;
        selectedMessageIds.forEach(id => handleDeleteForMe(id));
        setSelectionMode(false);
        setSelectedMessageIds([]);
    };

    // Close context menu on click elsewhere
    useEffect(() => {
        const hideMenu = () => setContextMenu(null);
        window.addEventListener('click', hideMenu);
        return () => window.removeEventListener('click', hideMenu);
    }, []);

    const handleSelectAll = () => {
        if (selectedMessageIds.length === messages.length) {
            setSelectedMessageIds([]);
        } else {
            setSelectedMessageIds(messages.map(m => m.id));
        }
    };



    // Fetch Messages when chat selected
    useEffect(() => {
        if (activeChat) {
            const fetchMessages = async () => {
                setMessages([]); // Clear messages when CHAT ID changes
                setIsLoadingMessages(true);
                try {
                    const { data } = await api.get(`/chats/${activeChat.id}/messages`);
                    setMessages(data);

                    // Mark messages as read in DB via API
                    await api.post(`/notifications/mark-read/${activeChat.id}`);
                    refreshUnreadCount();

                    // Emit to socket that we've read these messages
                    const partner = getPartner(activeChat);
                    if (partner && socket) {
                        socket.emit('markAsRead', {
                            chatId: activeChat.id,
                            userId: user?.id,
                            senderId: partner.id
                        });
                    }

                    // Update local chat list to clear unread count
                    setChats(prev => prev.map(c =>
                        c.id === activeChat.id
                            ? { ...c, _count: { messages: 0 } }
                            : c
                    ));
                } catch (error) {
                    console.error('Failed to fetch messages');
                } finally {
                    setIsLoadingMessages(false);
                }
            };
            fetchMessages();
        }
    }, [activeChat?.id, refreshUnreadCount, socket, user?.id]);

    // Handle typing indicator emission
    useEffect(() => {
        if (!activeChat || !socket || !newMessage.trim()) {
            if (activeChat && socket && !newMessage.trim()) {
                const recipient = getPartner(activeChat);
                if (recipient) {
                    socket.emit('stopTyping', { chatId: activeChat.id, recipientId: recipient.id });
                }
            }
            return;
        }

        const recipient = getPartner(activeChat);
        if (!recipient) return;

        const chatId = activeChat.id;
        const recipientId = recipient.id;

        socket.emit('typing', { chatId, recipientId });

        const timer = setTimeout(() => {
            socket.emit('stopTyping', { chatId, recipientId });
        }, 3000);

        return () => {
            clearTimeout(timer);
            // We don't stop typing on every keystroke, but the 3s timer handles the idle case.
        };
    }, [newMessage, activeChat, socket]);

    const scrollToBottom = (smooth = false) => {
        if (messagesAreaRef.current) {
            messagesAreaRef.current.scroll({
                top: messagesAreaRef.current.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
    };

    // Jump to bottom instantly when messages load or chat changes
    useEffect(() => {
        if (!isLoadingMessages) {
            scrollToBottom(false);
            requestAnimationFrame(() => scrollToBottom(false));
        }
    }, [isLoadingMessages, activeChat?.id, messages.length]);



    const addEmoji = (emoji: string) => {
        setNewMessage(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!newMessage.trim() && !selectedImage) || !activeChat || !user || !socket) return;

        let imageUrl = undefined;

        if (selectedImage) {
            setIsUploading(true);
            const formData = new FormData();
            formData.append('image', selectedImage);
            try {
                const { data } = await api.post('/upload/chat-image', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                imageUrl = data.url;
            } catch (error) {
                console.error('Image upload failed:', error);
                toast.error('Failed to upload image');
                setIsUploading(false);
                return;
            }
        }

        const recipient = activeChat.participants.find((p) => p.id !== user.id);
        if (!recipient) return;

        const messageContent = newMessage;
        const currentIsViewOnce = isViewOnce;

        // OPTIMISTIC UPDATE: Add message to UI immediately
        const optimisticId = -Date.now();
        const optimisticMsg: any = {
            id: optimisticId,
            chatId: activeChat.id,
            senderId: user.id,
            content: messageContent,
            imageUrl: imageUrl, 
            isViewOnce: currentIsViewOnce,
            createdAt: new Date().toISOString(),
            isOptimistic: true,
            sender: { name: user.name, role: (user as any).role || 'USER' }
        };

        setMessages((prev) => [...prev, optimisticMsg]);
        setNewMessage('');
        setSelectedImage(null);
        setImagePreview(null);
        setIsUploading(false);
        setIsViewOnce(false);

        // Smooth scroll for new sent messages
        setTimeout(() => scrollToBottom(true), 0);

        socket.emit('sendMessage', {
            chatId: activeChat.id,
            senderId: user.id,
            content: messageContent,
            recipientId: recipient.id,
            imageUrl: imageUrl,
            isViewOnce: currentIsViewOnce
        });

        // Immediately stop typing indicator on send
        socket.emit('stopTyping', { chatId: activeChat.id, recipientId: recipient.id });
    };

    const getPartner = (chat: Chat) => {
        return chat.participants.find((p) => p.id !== user?.id);
    };

    const isPartnerDeleted = (chat: Chat) => {
        // If chat has only one participant (the current user), the other one was deleted from the many-to-many relationship
        return chat.participants.length < 2 && chat.participants.some(p => p.id === user?.id);
    };

    useEffect(() => {
        if (activeChat) {
            setShowSidebar(false);
        }
    }, [activeChat]);

    return (
        <div className="chat-page-root">
            <div className={`chat-container-wrapper ${showSidebar ? 'view-list' : 'view-chat'}`}>
                <div className="chat-layout glass-panel">
                    {/* Conversations Sidebar */}
                    <div className="chat-sidebar">
                        <div className="sidebar-header">
                            <h2>Messages</h2>
                        </div>

                        {isLoadingChats ? (
                            // Chat Sidebar Skeleton
                            Array(5).fill(0).map((_, i) => (
                                <div key={i} className="conversation-item skeleton">
                                    <div className="avatar skeleton-bg" />
                                    <div className="conversation-info" style={{ gap: '8px' }}>
                                        <div className="skeleton-line w-60 skeleton-bg" />
                                        <div className="skeleton-line w-40 skeleton-bg" />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <>
                                {chats.length === 0 && (
                                    <div className="empty-state">
                                        <div className="empty-icon">💬</div>
                                        <p>No conversations yet</p>
                                    </div>
                                )}
                                {chats.map((chat) => {
                                    const partner = getPartner(chat);
                                    const deleted = isPartnerDeleted(chat);
                                    const isActive = activeChat?.id === chat.id;
                                    const isTyping = typingUsers[chat.id];

                                    return (
                                        <div
                                            key={chat.id}
                                            onClick={() => { setActiveChat(chat); setShowSidebar(false); }}
                                            className={`conversation-item ${isActive ? 'active' : ''}`}
                                        >
                                            <div className="avatar-wrapper">
                                                <div
                                                    className={`avatar ${isActive ? 'avatar-active' : ''}`}
                                                    onClick={(e) => {
                                                        if (partner?.profile?.avatar && partner.profile.showAvatarPublicly !== false) {
                                                            e.stopPropagation();
                                                            setZoomedImage(partner.profile.avatar.startsWith('http') ? partner.profile.avatar : `${API_BASE}${partner.profile.avatar}`);
                                                        }
                                                    }}
                                                >
                                                    {partner?.profile?.avatar && partner.profile.showAvatarPublicly !== false ? (
                                                        <img src={partner.profile.avatar.startsWith('http') ? partner.profile.avatar : `${API_BASE}${partner.profile.avatar}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                                                    ) : (
                                                        (partner?.name || 'U').charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                {partner?.isOnline && !deleted && <div className="online-indicator" />}
                                            </div>
                                            <div className="conversation-info">
                                                <div className="conversation-name-row">
                                                    <span className={`partner-name ${deleted ? 'deleted' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {deleted ? 'Deleted Account' : (
                                                            partner?.role === 'SUPER_ADMIN' ?
                                                                <><span style={{ color: 'var(--primary)', fontWeight: 800 }}>Roommate-Connect</span> <CheckCircle size={14} color="#3b82f6" fill="#bfdbfe" /></> :
                                                                (partner?.name || 'User')
                                                        )}
                                                        {isBanned && partner?.role !== 'SUPER_ADMIN' && <span style={{ fontSize: '0.6rem', background: '#fee2e2', color: '#991b1b', padding: '1px 4px', borderRadius: '4px' }}>Read Only</span>}
                                                    </span>
                                                    {chat.messages[0] && (
                                                        <span className="last-msg-time">
                                                            {new Date(chat.messages[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="last-message">
                                                    {isTyping ? (
                                                        <span className="typing-indicator-sidebar">is typing...</span>
                                                    ) : (
                                                        deleted ? 'User left the platform' : (
                                                            chat.messages[0]?.imageUrl
                                                                ? (/\.(jpg|jpeg|png|webp|gif|jfif|svg)$/i.test(chat.messages[0].imageUrl) ? '📷 (Photo)' : '📁 (File)')
                                                                : (chat.messages[0]?.content || 'Start a conversation')
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                            {(chat._count?.messages || 0) > 0 && !deleted && (
                                                <div className="unread-badge">{chat._count?.messages}</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>

                    {/* Message Window */}
                    <div className="chat-window">
                        {activeChat ? (
                            <>
                                <div className="chat-header">
                                    <button className="back-btn" onClick={() => { setShowSidebar(true); setActiveChat(null); }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                    </button>
                                    <div className="header-info" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div
                                            className="avatar"
                                            style={{ width: '50px', height: '50px', flexShrink: 0, cursor: 'pointer', border: '2px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
                                            onClick={() => {
                                                const partner = getPartner(activeChat);
                                                if (partner?.profile?.avatar && partner.profile.showAvatarPublicly !== false) {
                                                    setZoomedImage(partner.profile.avatar.startsWith('http') ? partner.profile.avatar : `${API_BASE}${partner.profile.avatar}`);
                                                }
                                            }}
                                        >
                                            {getPartner(activeChat)?.profile?.avatar && getPartner(activeChat)?.profile?.showAvatarPublicly !== false ? (
                                                <img src={getPartner(activeChat)?.profile?.avatar?.startsWith('http') ? getPartner(activeChat)?.profile?.avatar : `${API_BASE}${getPartner(activeChat)?.profile?.avatar}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                                            ) : (
                                                (getPartner(activeChat)?.name || 'U').charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div className="header-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {isPartnerDeleted(activeChat) ? 'Deleted Account' : (
                                                    getPartner(activeChat)?.role === 'SUPER_ADMIN' ?
                                                        <><span style={{ color: 'var(--primary)', fontWeight: 900 }}>Roommate-Connect Official</span> <CheckCircle size={18} color="#3b82f6" fill="#bfdbfe" /></> :
                                                        (getPartner(activeChat)?.name || 'User')
                                                )}
                                            </div>
                                            {!isPartnerDeleted(activeChat) && (
                                                <div className={`header-status ${getPartner(activeChat)?.isOnline ? 'online' : 'offline'}`}>
                                                    <span className="status-dot"></span>
                                                    {getPartner(activeChat)?.isOnline ? 'Active Now' : `Last active ${formatLastSeen(getPartner(activeChat)?.lastSeen)}`}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        {/* Phone/Video icons could go here */}
                                        {!isPartnerDeleted(activeChat) && getPartner(activeChat)?.role !== 'SUPER_ADMIN' && (
                                            <div className="chat-header-more" style={{ position: 'relative' }}>
                                                <button 
                                                    className="icon-btn" 
                                                    onClick={() => setShowChatMenu(!showChatMenu)}
                                                    style={{ color: 'var(--text-muted)' }}
                                                >
                                                    <MoreVertical size={20} />
                                                </button>
                                                {showChatMenu && (
                                                    <div className="floating-menu" style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100, background: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', minWidth: '150px', padding: '0.5rem', animation: 'fadeIn 0.2s ease' }}>
                                                        <button 
                                                            className="menu-item" 
                                                            onClick={() => { setShowReportModal(true); setShowChatMenu(false); }}
                                                            style={{ border: 'none', background: 'none', width: '100%', padding: '0.8rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', fontWeight: 600, cursor: 'pointer', borderRadius: '8px' }}
                                                        >
                                                            <Flag size={18} />
                                                            Report User
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="messages-area" ref={messagesAreaRef}>
                                    {isLoadingMessages ? (
                                        Array(7).fill(0).map((_, i) => (
                                            <div key={i} className={`message-row ${i % 2 === 0 ? 'msg-me' : 'msg-them'} skeleton`}>
                                                <div className="message-bubble-wrapper">
                                                    <div className="message-bubble skeleton-bg" style={{ width: i % 3 === 0 ? '200px' : '120px', height: '45px', borderRadius: i % 2 === 0 ? '18px 18px 4px 18px' : '18px 18px 18px 4px' }} />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        messages.map((msg, index) => {
                                            const isMe = msg.senderId === user?.id;
                                            const partner = getPartner(activeChat);

                                            return (
                                                <div key={index} className={`message-row ${isMe ? 'msg-me' : 'msg-them'}`}>
                                                    {!isMe && (
                                                        <div
                                                            className="message-avatar"
                                                            onClick={() => {
                                                                if (partner?.profile?.avatar && partner.profile.showAvatarPublicly !== false) {
                                                                    setZoomedImage(partner.profile.avatar.startsWith('http') ? partner.profile.avatar : `${API_BASE}${partner.profile.avatar}`);
                                                                }
                                                            }}
                                                            style={{ cursor: partner?.profile?.avatar ? 'pointer' : 'default' }}
                                                        >
                                                            {partner?.profile?.avatar && partner.profile.showAvatarPublicly !== false ? (
                                                                <img
                                                                    src={partner.profile.avatar.startsWith('http') ? partner.profile.avatar : `${API_BASE}${partner.profile.avatar}`}
                                                                    alt=""
                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                                                />
                                                            ) : (
                                                                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: partner?.role === 'SUPER_ADMIN' ? 'var(--primary)' : '#eef2ff', color: partner?.role === 'SUPER_ADMIN' ? 'white' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', border: '1px solid rgba(79, 70, 229, 0.1)' }}>
                                                                    {partner?.role === 'SUPER_ADMIN' ? <Shield size={16} /> : (partner?.name || 'U').charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="message-bubble-wrapper">
                                                        <div
                                                            className={`message-bubble ${msg.isDeleted ? 'deleted' : ''}`}
                                                            onContextMenu={(e) => {
                                                                e.preventDefault(); // ALWAYS prevent default browser menu
                                                                if (!msg.isDeleted) {
                                                                    handleContextMenu(e, msg.id, isMe);
                                                                }
                                                            }}
                                                            onTouchStart={!msg.isDeleted ? onTouchStart(msg.id, isMe) : undefined}
                                                            onTouchEnd={onTouchEnd}
                                                            style={{
                                                                cursor: msg.isDeleted ? 'default' : 'context-menu',
                                                                userSelect: 'none',
                                                                WebkitUserSelect: 'none',
                                                                WebkitTouchCallout: 'none',
                                                                msUserSelect: 'none'
                                                            }}
                                                        >
                                                            {msg.isDeleted ? (
                                                                <span className="deleted-text">🚫 This message was deleted</span>
                                                            ) : (
                                                                <>
                                                                    {msg.imageUrl && (
                                                                        msg.isViewOnce && msg.isViewed ? (
                                                                            <div className="view-once-exploded">
                                                                                <EyeOff size={20} />
                                                                                <span>Message Viewed</span>
                                                                            </div>
                                                                        ) : msg.isViewOnce && !msg.isViewed ? (
                                                                            isMe ? (
                                                                                <div className="view-once-placeholder sender">
                                                                                    <ImageIcon size={20} />
                                                                                    <span>View Once Photo Sent</span>
                                                                                </div>
                                                                            ) : (
                                                                                <div
                                                                                    className="view-once-placeholder"
                                                                                    onClick={() => {
                                                                                        setZoomedImage(msg.imageUrl.startsWith('http') ? msg.imageUrl : `${API_BASE}${msg.imageUrl}`);
                                                                                        if (!isMe && socket && activeChat) {
                                                                                            socket.emit('markViewOnceOpened', {
                                                                                                messageId: msg.id,
                                                                                                recipientId: user?.id,
                                                                                                senderId: msg.senderId
                                                                                            });
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <Eye size={20} />
                                                                                    <span>Click to View Image Once</span>
                                                                                </div>
                                                                            )
                                                                        ) : (
                                                                            (/\.(jpg|jpeg|png|webp|gif|jfif|svg)$/i.test(msg.imageUrl) ? (
                                                                                <div
                                                                                    className="message-image-container"
                                                                                    style={{ marginBottom: msg.content ? '0.5rem' : '0', cursor: 'zoom-in' }}
                                                                                    onClick={() => setZoomedImage(msg.imageUrl.startsWith('http') ? msg.imageUrl : `${API_BASE}${msg.imageUrl}`)}
                                                                                >
                                                                                    <img
                                                                                        src={msg.imageUrl.startsWith('http') ? msg.imageUrl : `${API_BASE}${msg.imageUrl}`}
                                                                                        alt="Sent"
                                                                                        style={{ maxWidth: '100%', borderRadius: '8px', display: 'block' }}
                                                                                    />
                                                                                </div>
                                                                            ) : (
                                                                                <div className="message-file-container" style={{ marginBottom: msg.content ? '0.5rem' : '0' }}>
                                                                                    <a
                                                                                        href={msg.imageUrl.startsWith('http') ? msg.imageUrl : `${API_BASE}${msg.imageUrl}`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="file-attachment"
                                                                                    >
                                                                                        <FileText size={20} />
                                                                                        <span>{msg.imageUrl.split('/').pop()}</span>
                                                                                        <Download size={16} />
                                                                                    </a>
                                                                                    {msg.imageUrl.toLowerCase().endsWith('.pdf') && (
                                                                                        <button
                                                                                            onClick={(e) => { e.preventDefault(); setZoomedImage(msg.imageUrl.startsWith('http') ? msg.imageUrl : `${API_BASE}${msg.imageUrl}`); }}
                                                                                            style={{
                                                                                                marginTop: '0.5rem',
                                                                                                padding: '0.4rem 0.8rem',
                                                                                                borderRadius: '8px',
                                                                                                border: '1px solid var(--primary)',
                                                                                                background: 'rgba(79, 70, 229, 0.1)',
                                                                                                color: 'var(--primary)',
                                                                                                fontSize: '0.8rem',
                                                                                                fontWeight: 600,
                                                                                                cursor: 'pointer',
                                                                                                display: 'flex',
                                                                                                alignItems: 'center',
                                                                                                gap: '0.4rem',
                                                                                                width: 'fit-content'
                                                                                            }}
                                                                                        >
                                                                                            <Eye size={16} />
                                                                                            Preview PDF
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            ))
                                                                        )
                                                                    )}
                                                                    {msg.content}
                                                                    {msg.isViewOnce && !msg.isViewed && (
                                                                        <div className="view-once-badge">View Once</div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="message-info-row">
                                                            {selectionMode && !msg.isDeleted && (
                                                                <div
                                                                    className="selection-checkbox"
                                                                    onClick={() => toggleMessageSelection(msg.id)}
                                                                >
                                                                    {selectedMessageIds.includes(msg.id) ? (
                                                                        <CheckCircle size={18} color="var(--primary)" fill="white" />
                                                                    ) : (
                                                                        <Circle size={18} color="#ccc" />
                                                                    )}
                                                                </div>
                                                            )}
                                                            <div className="message-time">
                                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                            {isMe && !msg.isDeleted && (
                                                                <div className={`read-receipt ${msg.isRead ? 'read' : (msg.isDelivered ? 'delivered' : 'sent')}`}>
                                                                    {msg.isRead ? '✓✓' : (msg.isDelivered ? '✓✓' : '✓')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}

                                    {activeChat && typingUsers[activeChat.id] && (
                                        <div className="message-row msg-them">
                                            <div className="message-bubble typing-bubble">
                                                <div className="dot"></div>
                                                <div className="dot"></div>
                                                <div className="dot"></div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />

                                    {selectionMode && (
                                        <div className="selection-toolbar">
                                            <div className="selection-stats">
                                                <span>{selectedMessageIds.length} selected</span>
                                                <button onClick={handleSelectAll} className="link-btn">
                                                    {selectedMessageIds.length === messages.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>
                                            <div className="selection-actions">
                                                <button onClick={() => { setSelectionMode(false); setSelectedMessageIds([]); }} className="cancel-btn">Cancel</button>
                                                <button
                                                    onClick={handleBulkDelete}
                                                    className="delete-btn"
                                                    disabled={selectedMessageIds.length === 0}
                                                >
                                                    Delete Selected
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                </div>

                                {isPartnerDeleted(activeChat) ? (
                                    <div className="deleted-notice">
                                        🚫 This account no longer exists.
                                    </div>
                                ) : isBanned && getPartner(activeChat)?.role !== 'SUPER_ADMIN' ? (
                                    <div className="deleted-notice" style={{ background: '#fef2f2', color: '#991b1b', borderTop: '1px solid #fecaca' }}>
                                        🚫 This chat is in read-only mode due to account restrictions.
                                    </div>
                                ) : (
                                    <div className="chat-input-wrapper">
                                        {imagePreview && (
                                            <div className="image-preview-container">
                                                {selectedImage?.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|jfif|svg)$/i.test(selectedImage?.name || '') ? (
                                                    <img src={imagePreview} alt="Preview" />
                                                ) : (
                                                    <div className="file-preview-placeholder">
                                                        <FileText size={40} className="file-icon" />
                                                        <span className="file-name">{selectedImage?.name}</span>
                                                    </div>
                                                )}
                                                <div className="preview-actions">
                                                    <button
                                                        type="button"
                                                        className={`view-once-toggle ${isViewOnce ? 'active' : ''}`}
                                                        onClick={() => setIsViewOnce(!isViewOnce)}
                                                        title={isViewOnce ? "View once enabled" : "View once disabled"}
                                                    >
                                                        {isViewOnce ? <EyeOff size={16} /> : <Eye size={16} />}
                                                        <span>View Once</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="remove-preview"
                                                        onClick={() => { setSelectedImage(null); setImagePreview(null); setIsViewOnce(false); }}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {showEmojiPicker && (
                                            <div className="emoji-picker-simple">
                                                {emojis.map(e => (
                                                    <span key={e} onClick={() => addEmoji(e)} className="emoji-item">{e}</span>
                                                ))}
                                            </div>
                                        )}
                                        <form onSubmit={handleSendMessage} className="chat-input-area">
                                            <div className="chat-input-actions">
                                                <button
                                                    type="button"
                                                    className={`action-icon ${showEmojiPicker ? 'active' : ''}`}
                                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                >
                                                    <Smile size={22} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="action-icon"
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    <ImageIcon size={22} />
                                                </button>
                                                <input
                                                    type="file"
                                                    hidden
                                                    ref={fileInputRef}
                                                    onChange={handleFileSelect}
                                                />
                                            </div>
                                            <input
                                                ref={inputRef}
                                                className="chat-input"
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                placeholder="Type a message..."
                                            />
                                            <button
                                                type="submit"
                                                className="chat-send-btn"
                                                disabled={(!newMessage.trim() && !selectedImage) || isUploading}
                                                style={{ opacity: (!newMessage.trim() && !selectedImage) ? 0.5 : 1 }}
                                            >
                                                {isUploading ? <div className="loader-small" /> : <Send size={20} fill="white" />}
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="chat-empty-state">
                                <div className="empty-graphic">💬</div>
                                <div className="empty-text">
                                    <h3>Your Inbox</h3>
                                    <p>Select a person to start chatting</p>
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Image Zoom Modal */}
                </div>
            </div>

            {/* Image Zoom Modal - MOVED OUTSIDE FOR FULL SCREEN COVERAGE */}
            {zoomedImage && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        width: '100%',
                        height: '100%',
                        background: 'rgba(0,0,0,0.95)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2147483647, /* Maximum z-index */
                        cursor: 'zoom-out',
                        padding: '1rem',
                        boxSizing: 'border-box',
                        animation: 'fadeIn 0.3s ease'
                    }}
                    onClick={() => setZoomedImage(null)}
                >
                    {zoomedImage.toLowerCase().endsWith('.pdf') ? (
                        <div className="zoom-content" onClick={e => e.stopPropagation()}>
                            <iframe
                                src={zoomedImage}
                                title="PDF Preview"
                                style={{
                                    width: '90vw',
                                    height: '90vh',
                                    border: 'none',
                                    borderRadius: '12px',
                                    backgroundColor: 'white',
                                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                    animation: 'zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                                }}
                            />
                        </div>
                    ) : (
                        <div className="zoom-content" onClick={e => e.stopPropagation()}>
                            <img
                                src={zoomedImage}
                                alt="Zoomed"
                                style={{
                                    maxWidth: '95vw',
                                    maxHeight: '95vh',
                                    width: 'auto',
                                    height: 'auto',
                                    objectFit: 'contain',
                                    borderRadius: '8px',
                                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                    animation: 'zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                    border: '4px solid white',
                                    backgroundColor: 'white'
                                }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Report Modal */}
            {showReportModal && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
                    <div className="modal-card" style={{ background: 'white', width: '100%', maxWidth: '400px', borderRadius: '24px', padding: '2rem', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s ease' }}>
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ width: '60px', height: '60px', borderRadius: '20px', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                                <Flag size={30} fill="#ef4444" />
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Report User?</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Your report helps us keep the community safe.</p>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reason for Reporting</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {['VULGAR', 'SUSPICIOUS', 'SCAM', 'OTHER'].map(reason => (
                                    <button
                                        key={reason}
                                        onClick={() => setReportReason(reason)}
                                        style={{
                                            padding: '0.8rem',
                                            borderRadius: '12px',
                                            border: `2px solid ${reportReason === reason ? 'var(--primary)' : '#f1f5f9'}`,
                                            background: reportReason === reason ? 'var(--primary-light)' : 'white',
                                            color: reportReason === reason ? 'var(--primary)' : 'var(--text-main)',
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            textTransform: 'capitalize'
                                        }}
                                    >
                                        {reason.toLowerCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Evidence / Details</label>
                            <textarea
                                value={reportEvidence}
                                onChange={(e) => setReportEvidence(e.target.value)}
                                placeholder="Tell us more about what happened..."
                                style={{ width: '100%', padding: '1rem', borderRadius: '16px', border: '2px solid #f1f5f9', background: '#f8fafc', fontSize: '0.9rem', minHeight: '100px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => { setShowReportModal(false); setReportEvidence(''); }}
                                style={{ flex: 1, padding: '1rem', borderRadius: '16px', border: 'none', background: '#f1f5f9', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setIsSubmittingReport(true);
                                    try {
                                        if (!activeChat) return;
                                        await api.post('/reports', {
                                            reportedUserId: getPartner(activeChat!)?.id,
                                            chatId: activeChat.id,
                                            reason: reportReason,
                                            evidence: reportEvidence
                                        });
                                        // Show visual feedback or notification
                                        setShowReportModal(false);
                                        setReportEvidence('');
                                        refreshUnreadCount(); 
                                    } catch (err) {
                                        console.error('Report failed');
                                    } finally {
                                        setIsSubmittingReport(false);
                                    }
                                }}
                                disabled={isSubmittingReport}
                                style={{ flex: 1, padding: '1rem', borderRadius: '16px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: isSubmittingReport ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                {isSubmittingReport ? 'Sending...' : 'Submit Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {contextMenu && (
                <div className="action-sheet-overlay" onClick={() => setContextMenu(null)}>
                    <div
                        className="custom-context-menu centered"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="action-sheet-header">Message Options</div>
                        <button onClick={() => handleDeleteForMe(contextMenu.messageId)}>
                            <Trash2 size={18} />
                            Delete for Me
                        </button>
                        {contextMenu.isMe && (
                            <button onClick={() => {
                                if (window.confirm('Unsend this message for everyone?')) {
                                    handleUnsend(contextMenu.messageId);
                                }
                            }} className="unsend-opt">
                                <X size={18} />
                                Unsend for Everyone
                            </button>
                        )}
                        <button onClick={() => { setSelectionMode(true); toggleMessageSelection(contextMenu.messageId); setContextMenu(null); }}>
                            <CheckCircle size={18} />
                            Select
                        </button>
                        <button onClick={() => setContextMenu(null)} className="cancel-opt">
                            <X size={18} />
                            Close
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                .chat-page-root {
                    height: calc(100dvh - 64px); /* Exact navbar subtraction */
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    background: #f8fafc;
                }

                .chat-container-wrapper {
                    flex: 1;
                    padding: 0;
                    max-width: 100%; /* Go full width for premium feel */
                    width: 100%;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                    box-sizing: border-box;
                }

                .chat-layout {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                    background: white; /* Solid white for main chat area is more professional */
                    border-top: 1px solid rgba(0, 0, 0, 0.05);
                }

                /* Sidebar */
                .chat-sidebar {
                    width: 360px;
                    border-right: 1px solid #f1f5f9;
                    display: flex;
                    flex-direction: column;
                    background: white;
                }

                .sidebar-header {
                    padding: 1.25rem 1.5rem;
                    border-bottom: 1px solid #f1f5f9;
                }

                .sidebar-header h2 {
                    margin: 0;
                    font-size: 1.4rem;
                    font-weight: 800;
                    color: var(--text-main);
                    letter-spacing: -0.02em;
                }

                .conversations-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0.75rem;
                }

                .conversation-item {
                    display: flex;
                    align-items: center;
                    padding: 1rem;
                    gap: 1rem;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    margin-bottom: 0.25rem;
                }

                .conversation-item:hover {
                    background: rgba(255, 255, 255, 0.6);
                }

                .conversation-item.active {
                    background: white;
                    box-shadow: 0 4px 15px rgba(79, 70, 229, 0.1);
                }

                .avatar-wrapper {
                    position: relative;
                }

                .avatar {
                    width: 56px;
                    height: 56px;
                    border-radius: 18px;
                    background: #ffffff; /* White bg for transparency */
                    color: var(--primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    font-size: 1.2rem;
                    transition: all 0.2s;
                    border: 1px solid rgba(79, 70, 229, 0.1);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }

                .avatar-active {
                    background: var(--primary);
                    color: white;
                    border-color: var(--primary);
                }

                .online-indicator {
                    position: absolute;
                    bottom: -2px;
                    right: -2px;
                    width: 14px;
                    height: 14px;
                    background: #10b981;
                    border: 3px solid white;
                    border-radius: 50%;
                }

                .conversation-info {
                    flex: 1;
                    min-width: 0;
                }

                .conversation-name-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.25rem;
                }

                .partner-name {
                    font-weight: 700;
                    font-size: 1rem;
                    color: var(--text-main);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .partner-name.deleted { color: var(--text-muted); opacity: 0.7; }

                .last-msg-time {
                  font-size: 0.7rem;
                  color: var(--text-muted);
                  font-weight: 500;
                }

                .last-message {
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .unread-badge {
                    background: #ef4444;
                    color: white;
                    font-size: 0.7rem;
                    font-weight: 800;
                    padding: 2px 8px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(239, 68, 68, 0.3);
                }

                /* Chat Window */
                .chat-window {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: #f8fafc; /* Subtle off-white for message area */
                }

                .chat-header {
                    padding: 1rem 1.75rem;
                    background: white;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    z-index: 10;
                }

                .header-name {
                    font-weight: 800;
                    font-size: 1.2rem;
                    color: var(--text-main);
                    margin-bottom: 0.15rem;
                }

                .header-status {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .header-status.online { color: #10b981; }
                .header-status.offline { color: var(--text-muted); }

                .status-dot {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: currentColor;
                }

                .back-btn {
                    display: none;
                    background: none;
                    border: none;
                    color: var(--primary);
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 10px;
                    background: rgba(79, 70, 229, 0.05);
                }

                .messages-area {
                    flex: 1;
                    padding: 1.5rem 2rem; /* Reduced vertical padding */
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem; /* Tighter message gap */
                    background-image: radial-gradient(rgba(79, 70, 229, 0.03) 1px, transparent 1px);
                    background-size: 20px 20px;
                    scroll-behavior: smooth;
                    -webkit-overflow-scrolling: touch;
                }

                .message-row {
                    display: flex;
                    width: 100%;
                    align-items: flex-end; /* Align avatar to bottom */
                    gap: 0.75rem;
                }

                .msg-me { justify-content: flex-end; }
                .msg-them { justify-content: flex-start; }

                .message-avatar {
                    width: 38px;
                    height: 38px;
                    flex-shrink: 0;
                    margin-bottom: 4px; /* Align slightly with bubble */
                    transition: transform 0.2s;
                }
                .message-avatar:hover {
                    transform: scale(1.1);
                }

                .message-bubble-wrapper {
                    max-width: 70%;
                    display: flex;
                    flex-direction: column;
                    gap: 0.35rem;
                }

                .message-image-container {
                    border-radius: 12px;
                    overflow: hidden;
                    max-width: 250px; /* Force compact width */
                    width: 100%;
                    display: block;
                    margin-top: 0.4rem;
                }

                .message-image-container img {
                    max-width: 100%;
                    max-height: 320px; /* Force compact height */
                    width: auto;
                    height: auto;
                    object-fit: contain;
                    display: block;
                    border-radius: 8px;
                }

                .msg-me .message-image-container {
                    background: rgba(255,255,255,0.1);
                    border-color: rgba(255,255,255,0.2);
                }

                .message-bubble {
                    padding: 0.6rem 0.9rem;
                    font-size: 0.95rem;
                    line-height: 1.4;
                    position: relative;
                    word-wrap: break-word;
                    word-break: break-word;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                    overflow: hidden; /* Prevent any internal overflow */
                }

                .msg-me .message-bubble {
                    background: var(--primary);
                    color: white;
                    border-radius: 18px 18px 4px 18px;
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
                }
                
                .msg-them .message-bubble {
                    background: white;
                    color: var(--text-main);
                    border-radius: 18px 18px 18px 4px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
                    border: 1px solid #f1f5f9;
                }

                .message-time {
                    font-size: 0.65rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    padding: 0 0.5rem;
                }
                .msg-me .message-time { text-align: right; }

                .chat-input-area {
                    padding: 1rem 1.5rem;
                    background: white;
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                    border-top: 1px solid #f1f5f9;
                }

                .chat-input {
                    flex: 1;
                    padding: 0.9rem 1.25rem;
                    border-radius: 15px !important;
                    border: 1px solid #e5e7eb !important;
                    background: #f9fafb !important;
                    font-size: 0.95rem;
                    margin-bottom: 0 !important;
                    transition: all 0.2s;
                }

                .chat-input:focus {
                    background: white !important;
                    border-color: var(--primary) !important;
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
                }

                .chat-send-btn {
                    width: 48px;
                    height: 48px;
                    border-radius: 15px;
                    background: var(--primary);
                    color: white;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .chat-send-btn:hover:not(:disabled) {
                    transform: scale(1.05);
                    background: var(--primary-hover);
                }

                .chat-send-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }

                .action-sheet-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(5px);
                    -webkit-backdrop-filter: blur(5px);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.2s ease-out;
                }

                .custom-context-menu.centered {
                    position: relative;
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    border: 1px solid rgba(255,255,255,0.8);
                    z-index: 10001;
                    width: 280px;
                    max-width: 90%;
                    overflow: hidden;
                    animation: zoomIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    padding: 8px;
                }

                .action-sheet-header {
                    padding: 12px 16px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-bottom: 1px solid rgba(0,0,0,0.03);
                    margin-bottom: 8px;
                }
                .custom-context-menu button {
                    width: 100%;
                    padding: 14px 16px;
                    border: none;
                    background: none;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-main);
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                    border-radius: 12px;
                }
                .custom-context-menu button:hover { background: #f3f4f6; color: var(--primary); }
                .unsend-opt { color: #ef4444 !important; }
                .unsend-opt:hover { background: #fef2f2 !important; }
                .cancel-opt { margin-top: 8px; border-top: 1px solid rgba(0,0,0,0.03) !important; color: var(--text-muted) !important; }

                .selection-checkbox { cursor: pointer; display: flex; align-items: center; margin-right: 5px; }

                .selection-toolbar {
                    position: sticky;
                    bottom: 0px;
                    left: 0;
                    right: 0;
                    background: white;
                    border: 1px solid #eef2ff;
                    padding: 12px 20px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.05);
                    border-radius: 16px 16px 0 0;
                    z-index: 101;
                    animation: slideUp 0.3s ease-out;
                    margin: 0 -1.5rem;
                }

                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }

                .selection-stats { display: flex; align-items: center; gap: 15px; }
                .selection-stats span { font-weight: 700; color: var(--primary); }
                .link-btn { background: none; border: none; color: var(--text-muted); font-size: 0.8rem; font-weight: 600; cursor: pointer; }
                .link-btn:hover { color: var(--primary); text-decoration: underline; }

                .selection-actions { display: flex; gap: 10px; }
                .selection-actions button {
                    padding: 8px 16px;
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .cancel-btn { background: #f3f4f6; border: 1px solid #e5e7eb; color: var(--text-muted); }
                .cancel-btn:hover { background: #e5e7eb; }
                .delete-btn { background: #ef4444; border: none; color: white; }
                .delete-btn:hover { background: #dc2626; transform: scale(1.05); }
                .delete-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

                .read-receipt {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    font-weight: bold;
                    margin-left: 4px;
                    display: inline-flex;
                    transition: color 0.3s ease;
                }
                .read-receipt.read { color: #3b82f6; }
                .read-receipt.delivered { color: var(--text-muted); opacity: 0.8; }
                .read-receipt.sent { color: var(--text-muted); opacity: 0.5; }

                .message-bubble.deleted {
                    background: rgba(0,0,0,0.03) !important;
                    color: var(--text-muted) !important;
                    border: 1px dashed #ccc !important;
                    box-shadow: none !important;
                    font-style: italic;
                }
                .deleted-text { font-size: 0.85rem; opacity: 0.7; }

                .view-once-placeholder, .view-once-exploded {
                    background: rgba(0,0,0,0.05);
                    padding: 1.5rem;
                    border-radius: 12px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    cursor: pointer;
                    border: 2px dashed rgba(0,0,0,0.1);
                    transition: all 0.2s;
                }
                .msg-me .view-once-placeholder { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
                .view-once-placeholder.sender { cursor: default; }
                .view-once-placeholder.sender:hover { transform: none; }
                .view-once-placeholder:hover { transform: scale(1.02); background: rgba(0,0,0,0.08); }
                .msg-me .view-once-placeholder:hover:not(.sender) { background: rgba(255,255,255,0.15); }
                .view-once-placeholder span { font-size: 0.8rem; font-weight: 600; }

                .view-once-exploded { cursor: default; opacity: 0.6; }
                .view-once-exploded span { font-size: 0.8rem; }

                .view-once-badge {
                    font-size: 0.65rem;
                    font-weight: 800;
                    background: rgba(0,0,0,0.1);
                    padding: 2px 6px;
                    border-radius: 4px;
                    display: inline-block;
                    margin-top: 0.5rem;
                    text-transform: uppercase;
                }
                .msg-me .view-once-badge { background: rgba(255,255,255,0.2); }

                .preview-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .view-once-toggle {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    background: #fff;
                    border: 1px solid #e5e7eb;
                    padding: 0.4rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .view-once-toggle.active {
                    background: var(--primary);
                    color: white;
                    border-color: var(--primary);
                }
                .view-once-toggle:hover:not(.active) { background: #f9fafb; border-color: var(--primary); color: var(--primary); }

                .chat-empty-state {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 3rem;
                    color: var(--text-muted);
                }

                .empty-graphic {
                    font-size: 5rem;
                    margin-bottom: 1.5rem;
                    background: white;
                    width: 120px;
                    height: 120px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 40px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.05);
                }

                .empty-text h3 { color: var(--text-main); font-weight: 800; margin: 0 0 0.5rem 0; }
                .empty-text p { margin: 0; font-size: 1rem; }

                .empty-state {
                    padding: 4rem 2rem;
                    text-align: center;
                    color: var(--text-muted);
                }

                @media (max-width: 900px) {
                    .chat-sidebar { width: 320px; }
                }

                @media (max-width: 768px) {
                    .chat-container-wrapper {
                        height: calc(100vh - 70px); /* Adjusted for mobile nav height */
                        padding: 0;
                        margin: 0;
                        max-width: 100%;
                    }

                    .chat-layout { 
                        border-radius: 0; 
                        border: none; 
                        background: #fff; /* Solid bg for performance */
                    }

                    .chat-sidebar {
                        width: 100%;
                        background: #fff;
                    }

                    .chat-window {
                        width: 100%;
                        display: none;
                        position: fixed;
                        top: 0; /* Cover entire screen, potentially over nav if needed */
                        bottom: 0;
                        left: 0;
                        right: 0;
                        z-index: 2000; /* High z-index to cover everything */
                        background: #fff;
                        flex-direction: column; /* Force column layout */
                    }

                    .view-chat .chat-window { display: flex; }
                    
                    /* Header stays at top, non-scrollable */
                    .chat-header { 
                        padding: 0.8rem 1rem; 
                        background: white;
                        border-bottom: 1px solid #eee;
                        justify-content: flex-start;
                        gap: 0;
                        flex-shrink: 0; /* Do not shrink */
                        position: relative; /* Not sticky, just normal flow */
                        z-index: 10;
                    }

                    .back-btn { 
                        display: flex;
                        margin-right: 1rem;
                        flex-shrink: 0;
                    }

                    /* Messages area takes remaining space and scrolls internally */
                    .messages-area { 
                        flex: 1; /* Grow to fill space */
                        overflow-y: auto; /* Internal scroll */
                        -webkit-overflow-scrolling: touch; /* Smooth scroll */
                        padding: 1rem; 
                        padding-bottom: 90px; /* Space for input */
                        height: auto; /* Reset any fixed height */
                    }

                    .chat-input-wrapper {
                        position: absolute; /* Absolute within the fixed chat-window */
                        bottom: 0;
                        left: 0;
                        right: 0;
                        z-index: 100;
                        border-top: 1px solid #eee;
                        background: white;
                        width: 100%;
                        box-sizing: border-box;
                        padding-bottom: env(safe-area-inset-bottom);
                    }

                    .chat-input-area { 
                        padding: 0.6rem 1rem; /* Ensure horizontal padding */
                        gap: 0.8rem;
                        width: 100%;
                        box-sizing: border-box;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }

                    .chat-input {
                        padding: 0.6rem 0.8rem;
                        min-width: 0;
                        flex: 1;
                        font-size: 16px; 
                        width: 100%; /* Ensure it takes available space but shrinks */
                    }
                    
                    .chat-input-actions {
                        gap: 0.5rem;
                        padding-right: 2px; /* Safety buffer */
                    }
                    .action-icon {
                        width: 32px; 
                        height: 32px;
                    }
                    .chat-send-btn {
                        width: 40px; 
                        height: 40px;
                        flex-shrink: 0;
                        margin-left: 2px;
                    }
                }
                .read-receipt {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    font-weight: bold;
                    margin-left: 4px;
                }
                .read-receipt.read { color: #3b82f6; }

                .typing-indicator-sidebar { font-style: italic; color: var(--primary); font-size: 0.8rem; animation: pulse 1.5s infinite; }

                .typing-bubble {
                    display: flex;
                    gap: 4px;
                    padding: 0.6rem 0.8rem !important;
                    width: fit-content !important;
                    background: #f3f4f6 !important;
                }
                .typing-bubble .dot {
                    width: 6px;
                    height: 6px;
                    background: #9ca3af;
                    border-radius: 50%;
                    animation: typing 1s infinite alternate;
                }
                .typing-bubble .dot:nth-child(2) { animation-delay: 0.2s; }
                .typing-bubble .dot:nth-child(3) { animation-delay: 0.4s; }

                @keyframes typing {
                    from { opacity: 0.3; transform: translateY(0); }
                    to { opacity: 1; transform: translateY(-4px); }
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.6; }
                    100% { opacity: 1; }
                }

                /* Skeleton Loaders */
                .skeleton-bg {
                    background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%) !important;
                    background-size: 200% 100% !important;
                    animation: skeleton-loading 1.5s infinite !important;
                    border: none !important;
                }

                .skeleton-line {
                    height: 12px;
                    border-radius: 6px;
                }
                .w-60 { width: 60%; }
                .w-40 { width: 40%; }

                @keyframes skeleton-loading {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }

                /* New Attachment & Emoji Styles */
                .chat-input-wrapper {
                    display: flex;
                    flex-direction: column;
                    background: white;
                    border-top: 1px solid rgba(0, 0, 0, 0.03);
                }

                .image-preview-container {
                    padding: 1rem 2rem;
                    display: flex;
                    gap: 1rem;
                    background: #f9fafb;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.03);
                    position: relative;
                }

                .image-preview-container img {
                    height: 80px;
                    width: 80px;
                    object-fit: cover;
                    border-radius: 12px;
                    border: 2px solid white;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                }

                .remove-preview {
                    position: absolute;
                    top: 0.5rem;
                    left: 6.2rem; /* Adjusted based on width + relative padding */
                    background: #ef4444;
                    color: white;
                    border: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                }

                .emoji-picker-simple {
                    padding: 0.75rem 1.5rem;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                    background: white;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.03);
                }

                .emoji-item {
                    font-size: 1.5rem;
                    cursor: pointer;
                    transition: transform 0.2s;
                    user-select: none;
                }

                .emoji-item:hover {
                    transform: scale(1.3);
                }

                .chat-input-actions {
                    display: flex;
                    gap: 0.5rem;
                    flex-shrink: 0;
                }

                .action-icon {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    width: 42px;
                    height: 42px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .action-icon:hover {
                    background: #f3f4f6;
                    color: var(--primary);
                }

                .action-icon.active {
                    background: rgba(79, 70, 229, 0.1);
                    color: var(--primary);
                }

                .file-attachment {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    background: rgba(0,0,0,0.05);
                    padding: 0.6rem 1rem;
                    border-radius: 12px;
                    color: inherit;
                    text-decoration: none;
                    transition: all 0.2s;
                }
                .msg-me .file-attachment { background: rgba(255,255,255,0.15); color: white; }
                .file-attachment:hover { background: rgba(0,0,0,0.1); }
                .msg-me .file-attachment:hover { background: rgba(255,255,255,0.25); }
                
                .file-attachment span {
                    font-size: 0.85rem;
                    font-weight: 500;
                    max-width: 150px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .file-preview-placeholder {
                    width: 120px;
                    background: #fff;
                    border-radius: 12px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 0.75rem;
                    gap: 0.5rem;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.05);
                }
                .file-preview-placeholder .file-icon { color: var(--primary); }
                .file-preview-placeholder .file-name {
                    font-size: 0.7rem;
                    color: var(--text-muted);
                    max-width: 100%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .loader-small {
                    width: 20px;
                    height: 20px;
                    border: 2px solid white;
                    border-top-color: transparent;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                @keyframes zoomIn {
                    from { transform: scale(0.8); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }

                @media (max-width: 768px) {
                    .chat-page-root {
                        height: calc(100dvh - 5.5rem);
                        padding: 0;
                        margin: 0;
                    }
                    .chat-container-wrapper {
                        padding: 0;
                        border-radius: 0;
                        height: 100%;
                    }
                    .chat-layout {
                        border-radius: 0;
                        border: none;
                        display: flex;
                        overflow: hidden;
                    }
                    .chat-sidebar {
                        width: 100%;
                        display: ${showSidebar ? 'flex' : 'none'};
                        border-right: none;
                    }
                    .chat-window {
                        width: 100%;
                        display: ${!showSidebar ? 'flex' : 'none'};
                    }
                    .back-btn {
                        display: flex;
                    }
                    .chat-header {
                        padding: 0.8rem 1rem;
                    }
                    .messages-area {
                        padding: 1rem;
                    }
                    .message-bubble-wrapper {
                        max-width: 85%;
                    }
                    .message-image-container {
                        max-width: 200px;
                    }
                    .message-image-container img {
                        max-height: 250px;
                    }
                    .chat-input-area {
                        padding: 0.6rem 0.6rem;
                    }
                    .chat-input {
                        padding: 0.7rem 1rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default ChatPage;
