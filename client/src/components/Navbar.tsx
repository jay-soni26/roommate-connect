import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Home, PlusCircle, MessageCircle, Menu, X, Bell, Shield, BellOff, Heart, Users } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';
import { useSocket } from '../context/SocketContext';
import { usePush } from '../context/PushContext';
import api, { API_BASE } from '../api/client';
import { toast } from 'react-hot-toast';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    data: string; // JSON string
    isRead: boolean;
    createdAt: string;
}

const Navbar: React.FC = () => {
    const { user, logout, setBanned, updateUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { unreadCount: chatUnreadCount } = useNotification();
    const { t } = useLanguage();
    const { isSubscribed, subscribeUser, unsubscribeUser, isPushSupported } = usePush();
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [scrolled, setScrolled] = useState(false);

    // Notification System State
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [sysUnreadCount, setSysUnreadCount] = useState(0);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [selectedNotifs, setSelectedNotifs] = useState<number[]>([]);
    const notifRef = useRef<HTMLDivElement>(null);
    const { socket } = useSocket();

    const isLandingPage = location.pathname === '/';

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (!user) return;

        const fetchNotifications = async () => {
            try {
                // First-time profile check
                await api.get('/notifications/check-profile');

                const { data } = await api.get('/notifications');
                setNotifications(data);
                const { data: countData } = await api.get('/notifications/unread-system');
                setSysUnreadCount(countData.count);
            } catch (error) {
                console.error("Failed to fetch notifications", error);
            }
        };

        fetchNotifications();

        if (socket) {
            socket.on('notification', () => {
                setSysUnreadCount(prev => prev + 1);
                fetchNotifications();
                toast('📢 New official update received!', {
                    icon: '🔔',
                    style: {
                        borderRadius: '12px',
                        background: '#1e293b',
                        color: '#fff',
                        fontWeight: '600'
                    }
                });
            });

            socket.on('notificationsUpdated', () => {
                fetchNotifications();
            });

            socket.on('accountBanned', () => {
                setBanned(true);
                updateUser({ isBanned: true });
                navigate('/');
            });
            
            socket.on('accountUnbanned', () => {
                setBanned(false);
                updateUser({ isBanned: false });
                navigate('/');
            });
        }

        return () => {
            if (socket) {
                socket.off('notification');
                socket.off('notificationsUpdated');
            }
        };
    }, [user, socket]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setIsNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        setIsMenuOpen(false);
        navigate('/login');
    };

    const handleNotificationClick = async (notif: Notification) => {
        try {
            // Mark as read
            if (!notif.isRead) {
                await api.post(`/notifications/${notif.id}/read`);
                setSysUnreadCount(prev => Math.max(0, prev - 1));
                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
            }

            setIsNotifOpen(false); // Close dropdown

            // Special logic for PROFILE_COMPLETION
            if (notif.type === 'PROFILE_COMPLETION') {
                setIsMenuOpen(false); // Close menu
                navigate('/profile');
                return;
            }

            // Default logic for other notifications
            if (notif.data) {
                try {
                    const dataObj = JSON.parse(notif.data);
                    if (dataObj.roomId) {
                        navigate('/rooms?highlight=' + dataObj.roomId);
                    } else {
                        navigate('/rooms');
                    }
                } catch (e) {
                    navigate('/rooms');
                }
            } else {
                navigate('/rooms');
            }

        } catch (error) {
            console.error("Notif click error", error);
        }
    };

    const toggleNotif = () => {
        setIsNotifOpen(!isNotifOpen);
        setSelectedNotifs([]); // Clear on toggle
    };

    const handleSelectNotif = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        setSelectedNotifs(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedNotifs.length === notifications.length) {
            setSelectedNotifs([]);
        } else {
            setSelectedNotifs(notifications.map(n => n.id));
        }
    };

    const handleDeleteSelected = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedNotifs.length === 0) return;
        if (window.confirm(`Delete ${selectedNotifs.length} notifications?`)) {
            try {
                await api.delete('/notifications/bulk', { data: { ids: selectedNotifs } });
                setNotifications(prev => prev.filter(n => !selectedNotifs.includes(n.id)));
                setSelectedNotifs([]);
                // Sync unread
                const { data } = await api.get('/notifications/unread-system');
                setSysUnreadCount(data.count);
            } catch (error) {
                alert('Failed to delete');
            }
        }
    };

    const isWhite = isLandingPage && !scrolled;

    return (
        <nav className="glass-panel main-nav" style={{
            margin: '0.8rem 1.5rem',
            padding: '0.7rem 1.5rem',
            position: 'sticky',
            top: '0.8rem',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
            background: isLandingPage ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
            backdropFilter: isLandingPage ? 'none' : 'blur(20px)',
            WebkitBackdropFilter: isLandingPage ? 'none' : 'blur(20px)',
            border: isLandingPage ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: isLandingPage ? '0 10px 40px rgba(0,0,0,0.1)' : '0 8px 32px rgba(0,0,0,0.12)',
            borderRadius: '100px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Link to="/" onClick={() => setIsMenuOpen(false)} style={{
                    textDecoration: 'none',
                    color: 'var(--primary)',
                    fontWeight: 900,
                    fontSize: '1.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    transition: 'opacity 0.3s'
                }}>
                    <div className="logo-icon blue-glow-icon"><Home size={24} /></div>
                    <span className="mobile-hide">Roommate<span style={{ color: 'var(--text-main)', opacity: 0.6 }}>Connect</span></span>
                </Link>

                {/* Desktop Menu */}
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }} className="mobile-hide">
                    {user?.isBanned ? (
                        <Link to="/" className="nav-link">Home</Link>
                    ) : (
                        <>
                            <Link to="/rooms" className="nav-link">{t('nav.findRooms')}</Link>
                            <Link to="/find-roommates" className="nav-link">{t('nav.findRoommates')}</Link>
                            <Link to="/favorites" className="nav-link">Saved</Link>

                        </>
                    )}
                    
                    {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                        <Link to="/admin" className="nav-link admin-glow" style={{ color: 'var(--primary)', fontWeight: 800 }}>Admin Panel</Link>
                    )}

                    {user && !user.isBanned ? (
                        <>
                            <div className="nav-divider"></div>
                            <Link to="/post-room" className="btn-primary post-btn">
                                <PlusCircle size={18} /> <span>Create Post</span>
                            </Link>

                            <div className="nav-actions">
                                <Link to="/chat" className="action-icon" title="Messages">
                                    <MessageCircle size={22} />
                                    {chatUnreadCount > 0 && <span className="notif-badge">{chatUnreadCount}</span>}
                                </Link>


                                {/* Notification Bell */}
                                <div className="action-icon" style={{ cursor: 'pointer' }} onClick={toggleNotif} ref={notifRef}>
                                    <Bell size={22} />
                                    {sysUnreadCount > 0 && <span className="notif-badge">{sysUnreadCount}</span>}

                                    {/* Dropdown */}
                                    {isNotifOpen && (
                                        <div className="notif-dropdown">
                                            <div className="notif-header">
                                                <span>Notifications</span>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button 
                                                        onClick={handleSelectAll} 
                                                        className="notif-action-text"
                                                    >
                                                        {selectedNotifs.length === notifications.length ? 'Deselect' : 'Select All'}
                                                    </button>
                                                    {selectedNotifs.length > 0 && (
                                                        <button 
                                                            onClick={handleDeleteSelected} 
                                                            className="notif-action-text delete"
                                                        >
                                                            Delete ({selectedNotifs.length})
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="notif-list">
                                                {notifications.length === 0 ? (
                                                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No new notifications</div>
                                                ) : (
                                                    notifications.map(n => (
                                                        <div key={n.id} className={`notif-item ${!n.isRead ? 'unread' : ''} ${selectedNotifs.includes(n.id) ? 'selected' : ''}`} onClick={(e) => { e.stopPropagation(); handleNotificationClick(n); }}>
                                                            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={selectedNotifs.includes(n.id)} 
                                                                    onChange={(e) => e.stopPropagation()} 
                                                                    onClick={(e) => handleSelectNotif(e, n.id)} 
                                                                />
                                                                <div style={{ flex: 1 }}>
                                                                    <div className="notif-title">{n.title} {!n.isRead && <span className="dot"></span>}</div>
                                                                    <div className="notif-msg">{n.message}</div>
                                                                    <div className="notif-time">{new Date(n.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <Link to="/profile" className="profile-pill">
                                    <div className="avatar-sm">
                                        {user.avatar ? (
                                            <img src={user.avatar.startsWith('http') ? user.avatar : `${API_BASE}${user.avatar}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                        ) : (
                                            (user.name || 'U').charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <span>{user.name.split(' ')[0]}</span>
                                </Link>

                                <button onClick={handleLogout} className="logout-btn" title="Sign Out" style={{ color: isWhite ? '#faa' : '' }}>
                                    <LogOut size={20} />
                                </button>
                            </div>
                        </>
                    ) : user && user.isBanned ? (
                        <>
                            <Link to="/chat" className="action-icon" title="Appeal Chat" style={{ color: isWhite ? '#fff' : '' }}>
                                <MessageCircle size={22} />
                                {chatUnreadCount > 0 && <span className="notif-badge">{chatUnreadCount}</span>}
                            </Link>

                            {/* Notification Bell for Banned Users */}
                            <div className="action-icon" style={{ cursor: 'pointer' }} onClick={toggleNotif} ref={notifRef}>
                                <Bell size={22} />
                                {sysUnreadCount > 0 && <span className="notif-badge">{sysUnreadCount}</span>}
                                {isNotifOpen && (
                                    <div className="notif-dropdown">
                                        <div className="notif-header">
                                            <span>Notifications</span>
                                            {notifications.length > 0 && (
                                                <button onClick={handleDeleteSelected} className="notif-action-text delete">Delete All</button>
                                            )}
                                        </div>
                                        <div className="notif-list">
                                            {notifications.length === 0 ? (
                                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No new notifications</div>
                                            ) : (
                                                notifications.map(n => (
                                                    <div key={n.id} className={`notif-item ${!n.isRead ? 'unread' : ''}`} onClick={(e) => { e.stopPropagation(); handleNotificationClick(n); }}>
                                                        <div className="notif-title">{n.title} {!n.isRead && <span className="dot"></span>}</div>
                                                        <div className="notif-msg">{n.message}</div>
                                                        <div className="notif-time">{new Date(n.createdAt).toLocaleTimeString()}</div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <Link to="/profile" className="profile-pill">
                                <div className="avatar-sm">
                                    {user.avatar ? 
                                        <img src={user.avatar.startsWith('http') ? user.avatar : `${API_BASE}${user.avatar}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : 
                                        (user.name || 'U').charAt(0).toUpperCase()
                                    }
                                </div>
                                <span>{user.name.split(' ')[0]} (Restricted)</span>
                            </Link>
                            <button onClick={handleLogout} className="logout-btn"><LogOut size={20} /></button>
                        </>
                    ) : (
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <Link to="/login" className="nav-link">Login</Link>
                            <Link to="/register" className="btn-primary glow-btn-purple" style={{ padding: '0.6rem 1.5rem', borderRadius: '100px' }}>Join Community</Link>
                        </div>
                    )}
                </div>

                {/* Mobile Toggle */}
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className={`mobile-toggle mobile-show ${isMenuOpen ? 'open' : ''}`}
                >
                    {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
                </button>
            </div>

            {/* Mobile Drawer */}
            <div className={`mobile-drawer mobile-show ${isMenuOpen ? 'active' : ''}`}>
                <div className="drawer-content">
                    {user?.isBanned ? (
                        <>
                            <div className="drawer-section">
                                <label>Restricted Usage</label>
                                <Link to="/" className="drawer-item" onClick={() => setIsMenuOpen(false)}>
                                    <div className="icon"><Home size={20} /></div> Home
                                </Link>
                                <Link to="/profile" className="drawer-item" onClick={() => setIsMenuOpen(false)}>
                                    <div className="icon"><Shield size={20} /></div> Profile
                                </Link>
                            </div>
                        </>
                    ) : user ? (
                        <>
                            <div className="drawer-section">
                                <label>Explore</label>
                                <Link to="/rooms" className="drawer-item" onClick={() => setIsMenuOpen(false)}>
                                    <div className="icon"><Home size={20} /></div> Find Rooms
                                </Link>
                                <Link to="/find-roommates" className="drawer-item" onClick={() => setIsMenuOpen(false)}>
                                    <div className="icon"><Users size={20} /></div> Find Roommates
                                </Link>
                                <Link to="/favorites" className="drawer-item" onClick={() => setIsMenuOpen(false)}>
                                    <div className="icon"><Heart size={20} /></div> Saved
                                </Link>
                                <Link to="/post-room" className="drawer-item" onClick={() => setIsMenuOpen(false)}>
                                    <div className="icon"><PlusCircle size={20} /></div> Create Post
                                </Link>
                            </div>
                            <div className="drawer-section">
                                <label>Account</label>
                                <Link to="/chat" className="drawer-item" onClick={() => setIsMenuOpen(false)}>
                                    <div className="icon"><MessageCircle size={20} /></div> Messages
                                    {chatUnreadCount > 0 && <span className="drawer-badge">{chatUnreadCount}</span>}
                                </Link>
                                <Link to="/profile" className="drawer-item" onClick={() => setIsMenuOpen(false)}>
                                    <div className="icon">
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {user.avatar ? (
                                                <img src={user.avatar.startsWith('http') ? user.avatar : `${API_BASE}${user.avatar}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                            ) : (
                                                <Shield size={20} />
                                            )}
                                        </div>
                                    </div> Profile
                                </Link>
                                <div className="drawer-item" onClick={() => { setIsNotifOpen(!isNotifOpen); }}>
                                    <div className="icon"><Bell size={20} /></div> Notifications
                                    {sysUnreadCount > 0 && <span className="drawer-badge">{sysUnreadCount}</span>}
                                </div>

                                {isNotifOpen && (
                                    <div className="mobile-notif-container" style={{ margin: '0.5rem -1rem', padding: '1rem', background: 'rgba(79, 70, 229, 0.03)', borderRadius: '24px', border: '1px solid rgba(79, 70, 229, 0.1)' }}>
                                        <div className="notif-header" style={{ background: 'transparent', padding: '0 0 1rem 0', border: 'none' }}>
                                            <span style={{ fontSize: '1.1rem', color: 'var(--primary)', fontWeight: '800' }}>Updates</span>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                {notifications.length > 0 && (
                                                    <button onClick={(e) => { 
                                                        e.stopPropagation();
                                                        if (notifications.length > 0) {
                                                            setSelectedNotifs(notifications.map(n => n.id));
                                                            // We'll call the delete function after setting state
                                                            setTimeout(() => {
                                                                const btn = document.getElementById('mobile-delete-btn');
                                                                if (btn) btn.click();
                                                            }, 0);
                                                        }
                                                    }} className="notif-action-text delete">Clear All</button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="notif-list" style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {notifications.length === 0 ? (
                                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'white', borderRadius: '16px' }}>No new updates</div>
                                            ) : (
                                                notifications.map(n => (
                                                    <div key={n.id} className={`notif-item ${!n.isRead ? 'unread' : ''}`} style={{ borderRadius: '16px', padding: '1.2rem', background: 'white', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '4px' }} onClick={() => { handleNotificationClick(n); setIsMenuOpen(false); }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <div className="notif-title" style={{ margin: 0, fontSize: '1rem' }}>{n.title} {!n.isRead && <span className="dot"></span>}</div>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedNotifs([n.id]);
                                                                    setTimeout(() => {
                                                                        const btn = document.getElementById('mobile-delete-btn');
                                                                        if (btn) btn.click();
                                                                    }, 0);
                                                                }}
                                                                style={{ background: 'none', border: 'none', padding: '4px', color: '#ef4444' }}
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                        <div className="notif-msg" style={{ fontSize: '0.9rem', opacity: 0.8 }}>{n.message}</div>
                                                        <div className="notif-time" style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px' }}>{new Date(n.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        {/* Hidden delete button to leverage existing logic */}
                                        <button id="mobile-delete-btn" style={{ display: 'none' }} onClick={handleDeleteSelected}></button>
                                    </div>
                                )}    )}
                                {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                                    <Link to="/admin" className="drawer-item admin-glow" onClick={() => setIsMenuOpen(false)}>
                                        <div className="icon"><Shield size={20} /></div> Admin Panel
                                    </Link>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="drawer-section">
                            <label>Welcome</label>
                            <Link to="/rooms" className="drawer-item" onClick={() => setIsMenuOpen(false)}>
                                <div className="icon"><Home size={20} /></div> Find Rooms
                            </Link>
                            <Link to="/find-roommates" className="drawer-item" onClick={() => setIsMenuOpen(false)}>
                                <div className="icon"><Users size={20} /></div> Find Roommates
                            </Link>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                <Link to="/login" className="btn-secondary" style={{ textAlign: 'center', padding: '1rem', borderRadius: '16px' }} onClick={() => setIsMenuOpen(false)}>Login</Link>
                                <Link to="/register" className="btn-primary" style={{ textAlign: 'center', padding: '1rem', borderRadius: '16px' }} onClick={() => setIsMenuOpen(false)}>Register</Link>
                            </div>
                        </div>
                    )}
                    
                    {user && (
                        <button onClick={handleLogout} className="drawer-logout" style={{ background: '#ef4444', color: 'white', border: 'none', boxShadow: '0 8px 20px rgba(239, 68, 68, 0.3)', marginTop: '1rem' }}>
                            <LogOut size={20} /> Sign Out
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                .main-nav { box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
                .nav-link { text-decoration: none; color: var(--text-muted); font-weight: 600; font-size: 0.95rem; transition: color 0.2s; }
                .nav-link:hover { color: var(--primary); }
                
                .glow-btn-purple {
                    background: var(--primary) !important;
                    box-shadow: 0 0 15px rgba(79, 70, 229, 0.4);
                    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .glow-btn-purple:hover {
                    box-shadow: 0 0 25px rgba(79, 70, 229, 0.6);
                    transform: translateY(-2px);
                }

                .blue-glow-icon {
                    filter: drop-shadow(0 0 4px rgba(79, 70, 229, 0.3));
                }
                
                .nav-divider { width: 1px; height: 24px; background: var(--glass-border); margin: 0 0.5rem; }
                .nav-actions { display: flex; align-items: center; gap: 1rem; }
                
                .action-icon { color: var(--text-muted); transition: all 0.2s; position: relative; display: flex; }
                .action-icon:hover { color: var(--primary); transform: translateY(-2px); }
                
                .notif-badge { 
                    position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; border-radius: 50%; 
                    width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 800;
                    border: 2px solid white;
                }

                .profile-pill {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    padding: 0.3rem 0.8rem 0.3rem 0.3rem;
                    background: #f1f5f9;
                    border-radius: 40px;
                    text-decoration: none;
                    color: var(--text-main);
                    font-weight: 700;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                }
                .profile-pill:hover { background: #e2e8f0; transform: translateY(-1px); }
                
                .avatar-sm {
                    width: 32px;
                    height: 32px;
                    background: var(--primary);
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.9rem;
                    box-shadow: 0 2px 6px rgba(79, 70, 229, 0.2);
                }
                
                .logout-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 0.5rem; transition: color 0.2s; }
                .logout-btn:hover { color: #ef4444; }

                .post-btn { padding: 0.6rem 1.2rem; display: flex; align-items: center; gap: 0.5rem; font-weight: 700; border-radius: 12px; }

                /* Notif Dropdown */
                .notif-dropdown {
                    position: absolute; top: 120%; right: 0; width: 320px;
                    background: white; border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.15); border: 1px solid var(--glass-border);
                    overflow: hidden; animation: slideIn 0.2s ease-out;
                    color: var(--text-main);
                }
                @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                .notif-header { padding: 1rem; border-bottom: 1px solid #f1f5f9; font-weight: 800; font-size: 1rem; color: var(--primary); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; }
                .notif-action-text { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 0.75rem; font-weight: 700; transition: color 0.2s; padding: 0.2rem 0.5rem; border-radius: 4px; }
                .notif-action-text:hover { color: var(--primary); background: rgba(79, 70, 229, 0.05); }
                .notif-action-text.delete { color: #ef4444; }
                .notif-action-text.delete:hover { background: rgba(239, 68, 68, 0.05); }

                .notif-list { max-height: 400px; overflow-y: auto; }
                .notif-item { padding: 0.8rem 1rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.2s; position: relative; }
                .notif-item:hover { background: #f8fafc; }
                .notif-item.unread { background: rgba(79, 70, 229, 0.04); }
                .notif-item.selected { background: rgba(79, 70, 229, 0.08); border-left: 3px solid var(--primary); }
                .notif-title { font-weight: 700; font-size: 0.9rem; margin-bottom: 0.3rem; display: flex; align-items: center; justify-content: space-between; }
                .notif-msg { font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; }
                .notif-time { font-size: 0.7rem; color: var(--text-muted); margin-top: 0.5rem; text-align: right; }
                .dot { width: 8px; height: 8px; background: var(--primary); border-radius: 50%; display: inline-block; }

                /* Mobile Toggle */
                .mobile-toggle { 
                    background: none; border: none; cursor: pointer; padding: 0.5rem; color: var(--text-main); 
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: none;
                }
                .mobile-toggle.open { transform: rotate(90deg); color: var(--primary); }

                /* Mobile Drawer */
                .mobile-drawer {
                    position: fixed;
                    top: 5.5rem;
                    left: 0.8rem;
                    right: 0.8rem;
                    background: rgba(255, 255, 255, 0.98);
                    backdrop-filter: blur(20px);
                    border-radius: 24px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.15);
                    padding: 2rem;
                    z-index: 1001;
                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(-20px) scale(0.95);
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    max-height: calc(100vh - 8rem);
                    overflow-y: auto;
                    border: 1px solid var(--glass-border);
                }
                .mobile-drawer.active { opacity: 1; visibility: visible; transform: translateY(0) scale(1); }
                
                .drawer-content { display: flex; flex-direction: column; gap: 2rem; }
                .drawer-section { display: flex; flex-direction: column; gap: 0.8rem; border-top: 1px solid #f1f5f9; padding-top: 1.5rem; }
                .drawer-section:first-child { border: none; padding: 0; }
                .drawer-section label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); font-weight: 800; margin-bottom: 0.4rem; }
                .drawer-section a, .drawer-section .drawer-item { text-decoration: none; cursor: pointer; }
                
                .drawer-item { 
                    display: flex; align-items: center; gap: 1rem; padding: 1rem; border-radius: 16px; transition: all 0.2s;
                    color: var(--text-main); font-weight: 700; font-size: 1.1rem; background: #f8fafc;
                }
                .drawer-item:active { transform: scale(0.98); background: #f1f5f1; }
                .drawer-item .icon { font-size: 1.4rem; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: white; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                
                .drawer-badge { margin-left: auto; background: #ef4444; color: white; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.8rem; }
                
                .drawer-logout { 
                    display: flex; align-items: center; justify-content: center; gap: 0.8rem; width: 100%; padding: 1rem; 
                    background: none; border: 2px solid #fee2e2; color: #ef4444; border-radius: 16px; font-weight: 700; font-size: 1rem; cursor: pointer;
                }

                .admin-glow {
                    position: relative;
                    animation: adminPulse 2s infinite;
                }

                @keyframes adminPulse {
                    0% { text-shadow: 0 0 0px rgba(79, 70, 229, 0); }
                    50% { text-shadow: 0 0 10px rgba(79, 70, 229, 0.4); }
                    100% { text-shadow: 0 0 0px rgba(79, 70, 229, 0); }
                }

                @media (max-width: 850px) {
                    .mobile-hide { display: none !important; }
                    .mobile-toggle { display: flex !important; }
                    .mobile-show { display: flex !important; }
                }
            `}</style>
        </nav>
    );
};

export default Navbar;
