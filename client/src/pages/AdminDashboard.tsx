import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Users, Home, MessageSquare, Trash2, Shield, Bell, Send, UserX, UserCheck, Search, Info, X, MapPin, Phone, Briefcase, User as UserIcon, BarChart3, TrendingUp, History, ShieldAlert, UserPlus, Key } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { toast } from 'react-hot-toast';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    _count: { rooms: number };
    isBanned: boolean;
    phoneNumber?: string;
    profile: { 
        city: string;
        state?: string;
        gender?: string;
        occupation?: string;
        bio?: string;
    } | null;
}

interface Room {
    id: number;
    title: string;
    rentPerPerson: number;
    postingType: string;
    createdAt: string;
    owner: { name: string; email: string };
}

interface Stats {
    totalUsers: number;
    totalRooms: number;
    totalChats: number;
    recentUsers: number;
    pendingReports: number;
}

interface Report {
    id: number;
    reportId: string;
    reporterId: number;
    reporter: { name: string; email: string };
    reportedUserId: number;
    reportedUser: { id: number, name: string; email: string; isBanned: boolean };
    chatId: number | null;
    reason: string;
    evidence: string;
    status: string;
    adminAction: string | null;
    adminNote: string | null;
    previousViolations?: number;
    totalReportsCount?: number;
    createdAt: string;
    chat?: { messages: any[] };
}

const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();
    const [stats, setStats] = useState<Stats | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'rooms' | 'broadcast' | 'reports' | 'analytics' | 'logs' | 'team'>('analytics');
    const [reportSubTab, setReportSubTab] = useState<'pending' | 'history'>('pending');
    const [reports, setReports] = useState<Report[]>([]);
    
    // Analytics & Logs State
    const [analyticsData, setAnalyticsData] = useState<{ growth: any[], cityDistribution: any[] } | null>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [team, setTeam] = useState<any[]>([]);
    
    // Broadcast state
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'filtered' | 'single'>('all');
    const [singleTargetId, setSingleTargetId] = useState('');

    // Advanced User Filters
    const [userSearch, setUserSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all');
    const [cityFilter, setCityFilter] = useState('all');
    const [selectedUserInfo, setSelectedUserInfo] = useState<User | null>(null);

    useEffect(() => {
        fetchData();
    }, [user]);

    useEffect(() => {
        if (!socket) return;

        const handleRoomDeleted = (data: any) => {
            const idToRemove = data && typeof data === 'object' ? data.id : data;
            setRooms(prev => prev.filter(r => String(r.id) !== String(idToRemove)));
            setStats(prev => prev ? { ...prev, totalRooms: Math.max(0, prev.totalRooms - 1) } : null);
        };

        const handleRoomCreated = () => {
            fetchData();
        };

        const handleUserStatusChanged = ({ userId, isBanned }: any) => {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, isBanned } : u));
        };

        const handleUserDeleted = (data: any) => {
            fetchData();
        };

        const handleReportUpdate = () => {
            fetchData();
        };

        const handleAdminActionLogged = (newLog: any) => {
            console.log('New admin log received:', newLog);
            setLogs(prev => [newLog, ...prev].slice(0, 200)); // Prepend and keep last 200
            // Also refresh stats for counter accuracy
            api.get('/admin/stats').then(res => setStats(res.data));
        };

        socket.on('roomDeleted', handleRoomDeleted);
        socket.on('roomCreated', handleRoomCreated);
        socket.on('userStatusChanged_Admin', handleUserStatusChanged); 
        socket.on('userDeleted', handleUserDeleted);
        socket.on('newReport', handleReportUpdate);
        socket.on('reportStatsUpdate', handleReportUpdate);
        socket.on('userCreated', handleReportUpdate); 
        socket.on('adminActionLogged', handleAdminActionLogged); 

        return () => {
            socket.off('roomDeleted', handleRoomDeleted);
            socket.off('roomCreated', handleRoomCreated);
            socket.off('userStatusChanged_Admin', handleUserStatusChanged);
            socket.off('userDeleted', handleUserDeleted);
            socket.off('newReport', handleReportUpdate);
            socket.off('reportStatsUpdate', handleReportUpdate);
            socket.off('userCreated', handleReportUpdate);
            socket.off('adminActionLogged', handleAdminActionLogged);
        };
    }, [socket]);

    const fetchData = async () => {
        try {
            if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
                const requests = [
                    api.get('/admin/stats'),
                    api.get('/admin/users'),
                    api.get('/admin/rooms'),
                    api.get('/admin/reports'),
                    api.get('/admin/analytics'),
                    api.get('/admin/logs')
                ];

                if (user.role === 'SUPER_ADMIN') {
                    requests.push(api.get('/admin/team'));
                }

                const results = await Promise.all(requests);
                
                setStats(results[0].data);
                setUsers(results[1].data);
                setRooms(results[2].data);
                setReports(results[3].data);
                setAnalyticsData(results[4].data);
                setLogs(results[5].data);
                if (user.role === 'SUPER_ADMIN' && results[6]) {
                    setTeam(results[6].data);
                }
            }
        } catch (error) {
            console.error('Failed to fetch admin data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (window.confirm("Are you sure you want to completely ban and delete this user? This cannot be undone.")) {
            try {
                await api.delete(`/admin/users/${id}`);
                // UI updates via socket 'userDeleted'
            } catch (e) {
                toast.error('Failed to delete user.');
            }
        }
    };

    const handleDeleteRoom = async (id: number) => {
        if (window.confirm("Delete this listing post?")) {
            try {
                await api.delete(`/admin/rooms/${id}`);
                // UI updates via socket 'roomDeleted'
            } catch (e) {
                toast.error('Failed to delete listing.');
            }
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = 
            u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
            u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
            u.id.toString().includes(userSearch);
        
        const matchesStatus = 
            statusFilter === 'all' ||
            (statusFilter === 'active' && !u.isBanned) ||
            (statusFilter === 'banned' && u.isBanned);
            
        const matchesCity = 
            cityFilter === 'all' || 
            u.profile?.city === cityFilter;
            
        return matchesSearch && matchesStatus && matchesCity;
    });

    const uniqueCities = Array.from(new Set(users.map(u => u.profile?.city).filter(Boolean)));

    const handleBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: any = {
                title: broadcastTitle,
                message: broadcastMsg,
            };

            if (broadcastTarget === 'filtered') {
                payload.targetIds = filteredUsers.map(u => u.id);
            } else if (broadcastTarget === 'single') {
                payload.targetUserId = Number(singleTargetId);
            }

            await api.post('/admin/broadcast', payload);
            
            const targetLabel = 
                broadcastTarget === 'all' ? 'all users' : 
                broadcastTarget === 'filtered' ? `${filteredUsers.length} filtered users` : 
                `User #${singleTargetId}`;

            toast.success(`Success! Message sent to ${targetLabel}.`);
            setBroadcastTitle('');
            setBroadcastMsg('');
            setBroadcastTarget('all');
            setSingleTargetId('');
        } catch (error) {
            toast.error('Broadcast failed. Check if User ID is valid.');
        }
    };

    const handleBanUser = async (id: number, currentStatus: boolean) => {
        const action = currentStatus ? 'unban' : 'ban';
        if (window.confirm(`Are you sure you want to ${action} this user?`)) {
            try {
                await api.post(`/admin/users/${id}/${action}`);
                setUsers(users.map(u => u.id === id ? { ...u, isBanned: !currentStatus } : u));
                toast.success(`User ${action}ned successfully.`);
            } catch (e) {
                toast.error(`Failed to ${action} user.`);
            }
        }
    };

    const handleOfficialMessage = async (targetId: number) => {
        const msg = window.prompt("Type official message as 'Roommate-Connect Official':");
        if (!msg) return;
        try {
            const { data } = await api.post('/admin/message-user', { targetUserId: targetId, message: msg });
            toast.success('Official message sent!');
            navigate('/chat', { state: { activeChatId: data.chatId } });
        } catch (e) {
            toast.error('Failed to send message');
        }
    };

    const handleReportAction = async (reportId: number, action: string) => {
        try {
            await api.post(`/admin/reports/${reportId}/action`, { action });
            // Full refresh to ensure consistency
            const [reportsRes, statsRes, usersRes] = await Promise.all([
                api.get('/admin/reports'),
                api.get('/admin/stats'),
                api.get('/admin/users')
            ]);
            setReports(reportsRes.data);
            setStats(statsRes.data);
            setUsers(usersRes.data);
            toast.success(`Report action '${action}' applied successfully.`);
        } catch (error) {
            console.error('Report action failed', error);
            toast.error('Failed to process report action');
        }
    };

    if (!user) return <div style={{ padding: '4rem', textAlign: 'center' }}>Please login first.</div>;

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
        return (
            <div className="container animate-fade-in" style={{ padding: '4rem 1rem', display: 'flex', justifyContent: 'center' }}>
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '500px' }}>
                    <Shield size={64} color="#ef4444" style={{ margin: '0 auto 1.5rem' }} />
                    <h2 style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: 900 }}>Access Denied</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
                        This is a restricted area. Please login with your official credentials.
                    </p>
                    <button onClick={() => navigate('/login')} className="btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', borderRadius: '14px' }}>
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container animate-fade-in" style={{ padding: '2rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: 'var(--primary)', color: 'white', padding: '1rem', borderRadius: '16px' }}><Shield size={32} /></div>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-main)' }}>{user.role === 'SUPER_ADMIN' ? 'Super Gateway' : 'Admin Hub'}</h1>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>{user.role === 'SUPER_ADMIN' ? 'Root Access Enabled' : 'Management Center'}</p>
                </div>
            </div>

            {loading ? <p>Loading system core...</p> : (
                <>
                    {/* STATS ROW */}
                    <div className="admin-stats-grid">
                        <div className="stat-card">
                            <div className="icon-wrapper blue"><Users size={24} /></div>
                            <div className="stat-info">
                                <span className="label">Total Users</span>
                                <span className="value">{stats?.totalUsers || 0}</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="icon-wrapper green"><Home size={24} /></div>
                            <div className="stat-info">
                                <span className="label">Active Rooms</span>
                                <span className="value">{stats?.totalRooms || 0}</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="icon-wrapper purple"><MessageSquare size={24} /></div>
                            <div className="stat-info">
                                <span className="label">Total Chats</span>
                                <span className="value">{stats?.totalChats || 0}</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="icon-wrapper red"><Shield size={24} /></div>
                            <div className="stat-info">
                                <span className="label">Pending Reports</span>
                                <span className="value">{stats?.pendingReports || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="admin-tabs" style={{ display: 'flex', gap: '1rem', margin: '2rem 0', background: 'rgba(255,255,255,0.5)', padding: '0.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                        <button onClick={() => setActiveTab('analytics')} className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}>
                            <BarChart3 size={18} /> Business Analytics
                        </button>
                        <button onClick={() => setActiveTab('users')} className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}>
                            <Users size={18} /> Manage Users
                        </button>
                        <button onClick={() => setActiveTab('rooms')} className={`tab-btn ${activeTab === 'rooms' ? 'active' : ''}`}>
                            <Home size={18} /> Manage Rooms
                        </button>
                        <button onClick={() => setActiveTab('broadcast')} className={`tab-btn ${activeTab === 'broadcast' ? 'active' : ''}`}>
                            <Bell size={18} /> Broadcast Center
                        </button>
                        <button onClick={() => setActiveTab('reports')} className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`} style={{ position: 'relative' }}>
                            <Shield size={18} /> Manage Reports
                            {stats?.pendingReports && stats.pendingReports > 0 && (
                                <span style={{ position: 'absolute', top: '-5px', right: '5px', background: '#ef4444', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', border: '2px solid white', fontWeight: 900 }}>
                                    {stats.pendingReports}
                                </span>
                            )}
                        </button>
                        <button onClick={() => setActiveTab('logs')} className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}>
                            <History size={18} /> Security Logs
                        </button>
                        {user.role === 'SUPER_ADMIN' && (
                            <button onClick={() => setActiveTab('team')} className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}>
                                <ShieldAlert size={18} /> Manage Team
                            </button>
                        )}
                    </div>

                    <div className="admin-content-area">
                        {activeTab === 'analytics' && analyticsData && (
                            <div className="animate-fade-in">
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                                    {/* Growth Chart */}
                                    <div className="glass-panel" style={{ padding: '2rem', minHeight: '400px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                            <h3 className="section-title" style={{ margin: 0 }}><TrendingUp size={20} color="var(--primary)" /> User Acquisition (30 Days)</h3>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '30px' }}>
                                                + {analyticsData.growth.reduce((sum, d) => sum + d.count, 0)} New Users
                                            </div>
                                        </div>
                                        <div style={{ width: '100%', height: '300px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={analyticsData.growth}>
                                                    <defs>
                                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                                                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis 
                                                        dataKey="date" 
                                                        stroke="#94a3b8" 
                                                        fontSize={10} 
                                                        tickFormatter={(str) => {
                                                            const parts = str.split('-');
                                                            return `${parts[2]}/${parts[1]}`;
                                                        }}
                                                    />
                                                    <YAxis stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                                                    <Tooltip 
                                                        contentStyle={{ background: 'white', borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                                                        labelStyle={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}
                                                    />
                                                    <Area type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* City Distribution */}
                                    <div className="glass-panel" style={{ padding: '2rem', minHeight: '400px' }}>
                                        <h3 className="section-title" style={{ marginBottom: '2rem' }}><MapPin size={20} color="#f59e0b" /> Listing Density by City</h3>
                                        <div style={{ width: '100%', height: '300px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={analyticsData.cityDistribution}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} fontWeight={700} />
                                                    <YAxis stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                                                    <Tooltip 
                                                        cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                                        contentStyle={{ background: 'white', borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                                                    />
                                                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                                        {analyticsData.cityDistribution.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={['#4f46e5', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'][index % 5]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeTab === 'users' && (
                            <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                                    <h3 className="section-title" style={{ margin: 0 }}><Users size={20} color="var(--primary)" /> Manage Users</h3>
                                    
                                    <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                                        {/* Advanced Search */}
                                        <div className="search-box">
                                            <Search size={16} />
                                            <input 
                                                type="text" 
                                                placeholder="Name, Email, or ID..." 
                                                value={userSearch}
                                                onChange={(e) => setUserSearch(e.target.value)}
                                            />
                                        </div>

                                        {/* Status Filter */}
                                        <select className="filter-select" value={statusFilter} onChange={(e: any) => setStatusFilter(e.target.value)}>
                                            <option value="all">All Status</option>
                                            <option value="active">Active Only</option>
                                            <option value="banned">Banned Only</option>
                                        </select>

                                        {/* City Filter */}
                                        <select className="filter-select" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
                                            <option value="all">All Cities</option>
                                            {uniqueCities.map(city => (
                                                <option key={city} value={city}>{city}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ overflowX: 'auto' }}>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Identification</th>
                                                <th>Account Details</th>
                                                <th>Access Level</th>
                                                <th>Reputation</th>
                                                <th>Content</th>
                                                <th>Operations</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.map(u => (
                                                <tr key={u.id}>
                                                    <td><span className="id-badge">#{u.id}</span></td>
                                                    <td>
                                                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{u.name}</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>{u.profile?.city || 'No City'}</div>
                                                    </td>
                                                    <td><span className={`role-badge ${u.role.toLowerCase()}`}>{u.role}</span></td>
                                                    <td>
                                                        {u.isBanned ? 
                                                            <span className="status-badge banned">BANNED</span> : 
                                                            <span className="status-badge active">ACTIVE</span>
                                                        }
                                                    </td>
                                                    <td style={{ fontWeight: 700 }}>{u._count.rooms} Lists</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            {/* Detailed Info Button */}
                                                            <button 
                                                                title="View Full Profile" 
                                                                className="action-btn info" 
                                                                onClick={() => setSelectedUserInfo(u)}
                                                            >
                                                                <Info size={18} />
                                                            </button>

                                                            <button title="Official Message" className="action-btn" onClick={() => handleOfficialMessage(u.id)} style={{ color: 'var(--primary)', background: 'rgba(79, 70, 229, 0.05)' }}><MessageSquare size={18} /></button>
                                                            
                                                            <button 
                                                                title={u.isBanned ? "Unban User" : "Ban User"} 
                                                                className="action-btn" 
                                                                onClick={() => handleBanUser(u.id, u.isBanned)} 
                                                                style={{ color: u.isBanned ? '#16a34a' : '#f59e0b', background: u.isBanned ? '#dcfce7' : '#fef3c7' }}
                                                            >
                                                                {u.isBanned ? <UserCheck size={18} /> : <UserX size={18} />}
                                                            </button>

                                                            {user.role === 'SUPER_ADMIN' && (
                                                                <button title="Delete Account" className="action-btn delete" onClick={() => handleDeleteUser(u.id)}><Trash2 size={18} /></button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredUsers.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No users found matching your search.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'rooms' && (
                            <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', overflow: 'hidden' }}>
                                <h3 className="section-title"><Home size={20} color="var(--primary)" /> Content Feed</h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>Listing Title</th>
                                                <th>Posted By</th>
                                                <th>Rent</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rooms.map(r => (
                                                <tr key={r.id}>
                                                    <td><span className="id-badge">#{r.id}</span></td>
                                                    <td>
                                                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{r.title}</div>
                                                        <div style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#fef3c7', color: '#92400e', borderRadius: '4px', display: 'inline-block', marginTop: '0.3rem', fontWeight: 800 }}>{r.postingType}</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>{r.owner.name}</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.owner.email}</div>
                                                    </td>
                                                    <td style={{ fontWeight: 700 }}>₹{r.rentPerPerson}</td>
                                                    <td>
                                                        <button title="Delete Post" className="action-btn delete" onClick={() => handleDeleteRoom(r.id)}><Trash2 size={18} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'broadcast' && (
                            <div className="glass-panel animate-fade-in" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
                                <h3 className="section-title"><Bell size={20} color="#f59e0b" /> Broadcast Message</h3>
                                <form onSubmit={handleBroadcast}>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label className="input-label">Broadcast Audience</label>
                                        <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                            <button 
                                                type="button"
                                                onClick={() => setBroadcastTarget('all')}
                                                style={{ 
                                                    flex: 1, 
                                                    padding: '0.7rem', 
                                                    borderRadius: '10px', 
                                                    border: '2px solid', 
                                                    borderColor: broadcastTarget === 'all' ? 'var(--primary)' : '#e2e8f0',
                                                    background: broadcastTarget === 'all' ? 'var(--primary-light)' : 'white',
                                                    color: broadcastTarget === 'all' ? 'var(--primary)' : 'var(--text-muted)',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem'
                                                }}
                                            >
                                                Total Base ({users.length})
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => setBroadcastTarget('filtered')}
                                                style={{ 
                                                    flex: 1, 
                                                    padding: '0.7rem', 
                                                    borderRadius: '10px', 
                                                    border: '2px solid', 
                                                    borderColor: broadcastTarget === 'filtered' ? 'var(--primary)' : '#e2e8f0',
                                                    background: broadcastTarget === 'filtered' ? 'var(--primary-light)' : 'white',
                                                    color: broadcastTarget === 'filtered' ? 'var(--primary)' : 'var(--text-muted)',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem'
                                                }}
                                            >
                                                Filtered ({filteredUsers.length})
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => setBroadcastTarget('single')}
                                                style={{ 
                                                    flex: 1, 
                                                    padding: '0.7rem', 
                                                    borderRadius: '10px', 
                                                    border: '2px solid', 
                                                    borderColor: broadcastTarget === 'single' ? 'var(--primary)' : '#e2e8f0',
                                                    background: broadcastTarget === 'single' ? 'var(--primary-light)' : 'white',
                                                    color: broadcastTarget === 'single' ? 'var(--primary)' : 'var(--text-muted)',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem'
                                                }}
                                            >
                                                Single ID
                                            </button>
                                        </div>

                                        {broadcastTarget === 'single' && (
                                            <div style={{ marginTop: '1rem', animation: 'fadeIn 0.3s' }}>
                                                <label className="input-label" style={{ fontSize: '0.7rem' }}>Enter Target User ID</label>
                                                <input 
                                                    type="number" 
                                                    placeholder="e.g. 101" 
                                                    className="admin-input" 
                                                    value={singleTargetId}
                                                    onChange={e => setSingleTargetId(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label className="input-label">Alert Title</label>
                                        <input type="text" required placeholder="e.g. Server Update" className="admin-input" value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} />
                                    </div>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label className="input-label">Notification Content</label>
                                        <textarea required placeholder="Message..." className="admin-input" style={{ height: '120px' }} value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} />
                                    </div>
                                    <button type="submit" className="btn-primary" style={{ width: '100%', padding: '1rem', borderRadius: '12px' }}>
                                        <Send size={18} /> Send Official Notification
                                    </button>
                                </form>
                            </div>
                        )}
                        {activeTab === 'reports' && (
                            <div className="glass-panel animate-fade-in" style={{ padding: '2rem', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                    <div>
                                        <h3 className="section-title" style={{ marginBottom: '0.2rem' }}><Shield size={22} color="#ef4444" /> Crisis Management</h3>
                                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Monitor and resolve community reports in real-time</p>
                                    </div>
                                    <div className="sub-tab-nav">
                                        <button 
                                            className={`sub-tab-btn ${reportSubTab === 'pending' ? 'active' : ''}`}
                                            onClick={() => setReportSubTab('pending')}
                                        >
                                            Ongoing Disputes {stats?.pendingReports && stats.pendingReports > 0 ? `(${stats.pendingReports})` : ''}
                                        </button>
                                        <button 
                                            className={`sub-tab-btn ${reportSubTab === 'history' ? 'active' : ''}`}
                                            onClick={() => setReportSubTab('history')}
                                        >
                                            Resolution History
                                        </button>
                                    </div>
                                </div>

                                {reportSubTab === 'pending' ? (
                                    <>
                                        {reports.filter(r => r.status === 'PENDING').length === 0 ? (
                                            <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                <div style={{ width: '80px', height: '80px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                                                    <Shield size={40} />
                                                </div>
                                                <h4 style={{ color: 'var(--text-main)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>System Clear</h4>
                                                <p>No pending reports. The community is operating safely.</p>
                                            </div>
                                        ) : (
                                            <div style={{ overflowX: 'auto' }}>
                                                <table className="admin-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Case ID</th>
                                                            <th>Parties Involved</th>
                                                            <th>Category</th>
                                                            <th>Evidence / Context</th>
                                                            <th>Enforcement</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {reports.filter(r => r.status === 'PENDING').map(r => (
                                                            <tr key={r.id}>
                                                                <td><span className="case-badge">{r.reportId}</span></td>
                                                                <td>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                        <div style={{ fontSize: '0.85rem' }}><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>By:</span> <strong>{r.reporter.name}</strong> <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({r.reporter.email})</span></div>
                                                                        <div style={{ fontSize: '0.85rem' }}><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Vs:</span> <strong style={{ color: r.reportedUser.isBanned ? '#ef4444' : 'inherit' }}>{r.reportedUser.name}</strong> <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({r.reportedUser.email})</span></div>
                                                                        <div style={{ fontSize: '0.7rem', color: (r.previousViolations || 0) > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 700, marginTop: '2px' }}>
                                                                            History: {r.previousViolations || 0} Strikes | {r.totalReportsCount || 0} Past Reports
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span className={`reason-pill ${r.reason.toLowerCase()}`}>
                                                                        {r.reason}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <div className="evidence-preview" title={r.evidence}>
                                                                        {r.evidence || 'No text evidence provided'}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                                        <button 
                                                                            className="control-btn chat" 
                                                                            onClick={() => navigate('/chat', { state: { partnerId: r.reporterId } })}
                                                                            title="Interrogate/Message Reporter"
                                                                        >
                                                                            <MessageSquare size={16} />
                                                                        </button>
                                                                        <div className="action-divider" />
                                                                        <button 
                                                                            className="control-btn ban" 
                                                                            onClick={() => handleReportAction(r.id, 'BAN')}
                                                                            title="Permanent Restriction"
                                                                        >
                                                                            <UserX size={16} />
                                                                        </button>
                                                                        <button 
                                                                            className="control-btn warn" 
                                                                            onClick={() => handleReportAction(r.id, 'WARNING')}
                                                                            title="Issue System Warning"
                                                                        >
                                                                            <Bell size={16} />
                                                                        </button>
                                                                        <button 
                                                                            className="control-btn dismiss" 
                                                                            onClick={() => handleReportAction(r.id, 'NONE')}
                                                                            title="No Violation / Archive"
                                                                        >
                                                                            <UserCheck size={16} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="admin-table">
                                            <thead>
                                                <tr>
                                                    <th>ID</th>
                                                    <th>Incident Against</th>
                                                    <th>Moderation Verdict</th>
                                                    <th>Resolution Date</th>
                                                    <th>Interaction</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reports.filter(r => r.status !== 'PENDING').map(r => (
                                                    <tr key={r.id}>
                                                        <td><span className="case-badge gray">{r.reportId}</span></td>
                                                        <td>
                                                            <div style={{ fontWeight: 700 }}>{r.reportedUser.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.reportedUser.email}</div>
                                                        </td>
                                                        <td>
                                                            <span className={`verdict-pill ${r.adminAction?.toLowerCase() || 'none'}`}>
                                                                {r.adminAction || 'DISMISSED'}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                            {new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                                        </td>
                                                        <td>
                                                            <button 
                                                                className="control-btn chat" 
                                                                onClick={() => navigate('/chat', { state: { partnerId: r.reporterId } })}
                                                                title="Follow up with Reporter"
                                                            >
                                                                <MessageSquare size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {reports.filter(r => r.status !== 'PENDING').length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No historical resolution records.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'logs' && (
                            <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', overflow: 'hidden' }}>
                                <h3 className="section-title"><History size={20} color="var(--primary)" /> Security Audit Logs</h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Timestamp</th>
                                                <th>Admin</th>
                                                <th>Action</th>
                                                <th>Description</th>
                                                <th>Target</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {logs.map(log => (
                                                <tr key={log.id}>
                                                    <td style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                        {new Date(log.createdAt).toLocaleString()}
                                                    </td>
                                                    <td style={{ fontWeight: 700 }}>{log.adminName} <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>#{log.adminId}</span></td>
                                                    <td>
                                                        <span style={{ 
                                                            padding: '0.3rem 0.6rem', 
                                                            borderRadius: '6px', 
                                                            fontSize: '0.65rem', 
                                                            fontWeight: 900,
                                                            background: log.action.includes('BAN') || log.action.includes('DELETE') ? '#fee2e2' : '#e0f2fe',
                                                            color: log.action.includes('BAN') || log.action.includes('DELETE') ? '#ef4444' : '#0ea5e9'
                                                        }}>
                                                            {log.action}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '0.85rem' }}>{log.details}</td>
                                                    <td><span className="id-badge">#{log.targetId || 'N/A'}</span></td>
                                                </tr>
                                            ))}
                                            {logs.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No logs recorded yet.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'team' && user.role === 'SUPER_ADMIN' && (
                            <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: '2rem' }}>
                                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                    <h3 className="section-title"><ShieldAlert size={20} color="var(--primary)" /> Management Team</h3>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Admin</th>
                                                <th>Designation</th>
                                                <th>Role</th>
                                                <th>Contact</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {team.map(member => (
                                                <tr key={member.id}>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>{member.name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{member.email}</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>{member.designation || 'No Designation'}</div>
                                                    </td>
                                                    <td>
                                                        <span className={`role-badge ${member.role.toLowerCase()}`}>{member.role}</span>
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem' }}>{member.phoneNumber || 'N/A'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                    <h3 className="section-title"><UserPlus size={20} color="var(--primary)" /> Register Sub-Admin</h3>
                                    <form onSubmit={async (e) => {
                                        e.preventDefault();
                                        const formData = new FormData(e.currentTarget);
                                        const data = Object.fromEntries(formData);
                                        try {
                                            await api.post('/admin/create-subadmin', data);
                                            alert('Sub-Admin created successfully!');
                                            fetchData();
                                            (e.target as HTMLFormElement).reset();
                                        } catch (err: any) {
                                            alert(err.response?.data?.error || 'Failed to create admin');
                                        }
                                    }}>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label className="input-label">Full Name</label>
                                            <input name="name" type="text" className="admin-input" required placeholder="Admin Name" />
                                        </div>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label className="input-label">Work Email</label>
                                            <input name="email" type="email" className="admin-input" required placeholder="admin@example.com" />
                                        </div>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label className="input-label">Temporary Password</label>
                                            <input name="password" type="password" className="admin-input" required placeholder="••••••••" />
                                        </div>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label className="input-label">Designation</label>
                                            <input name="designation" type="text" className="admin-input" required placeholder="e.g. Head Moderator" />
                                        </div>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label className="input-label">Phone Number</label>
                                            <input name="phoneNumber" type="text" className="admin-input" required placeholder="+91 ..." />
                                        </div>
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <label className="input-label">Role Level</label>
                                            <select name="role" className="filter-select" style={{ width: '100%' }}>
                                                <option value="ADMIN">ADMIN (Sub-Admin)</option>
                                                <option value="SUPER_ADMIN">SUPER_ADMIN (Full Root Access)</option>
                                            </select>
                                        </div>
                                        <button type="submit" className="btn-primary" style={{ width: '100%', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                            <Key size={18} /> Provision Account
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            <style>{`
                .admin-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
                .stat-card { background: white; border-radius: 20px; padding: 1.5rem; display: flex; align-items: center; gap: 1.5rem; box-shadow: 0 10px 30px rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.05); }
                .icon-wrapper { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; }
                .icon-wrapper.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
                .icon-wrapper.green { background: rgba(16, 185, 129, 0.1); color: #10b981; }
                 .icon-wrapper.purple { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
                .icon-wrapper.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
                .stat-info .label { display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.2rem; }
                .stat-info .value { display: block; font-size: 1.8rem; font-weight: 900; color: var(--text-main); }

                .tab-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.6rem; padding: 0.8rem; border: none; background: transparent; border-radius: 12px; font-weight: 700; color: var(--text-muted); cursor: pointer; transition: all 0.2s; }
                .tab-btn:hover { background: rgba(255,255,255,0.8); color: var(--text-main); }
                .tab-btn.active { background: white; color: var(--primary); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }

                .section-title { margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.8rem; font-size: 1.3rem; font-weight: 800; }
                .admin-table { width: 100%; border-collapse: collapse; min-width: 600px; }
                .admin-table th { text-align: left; padding: 1.2rem 1rem; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 800; border-bottom: 2px solid #f1f5f9; }
                .admin-table td { padding: 1.2rem 1rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
                
                .id-badge { background: #f1f5f9; color: #64748b; padding: 0.3rem 0.6rem; border-radius: 8px; font-family: monospace; font-weight: 700; }
                .role-badge { padding: 0.3rem 0.8rem; border-radius: 30px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; }
                .role-badge.admin { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
                .role-badge.user { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
                .role-badge.owner { background: rgba(16, 185, 129, 0.1); color: #10b981; }

                .action-btn { border: none; background: transparent; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
                .action-btn.delete { color: #ef4444; background: #fee2e250; }
                .action-btn.delete:hover { background: #ef4444; color: white; }

                .input-label { display: block; font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem; text-transform: uppercase; }
                .admin-input { width: 100%; background: #f8fafc; border: 2px solid transparent; padding: 0.8rem 1rem; border-radius: 12px; font-size: 1rem; color: var(--text-main); font-family: inherit; box-sizing: border-box; }
                .admin-input:focus { outline: none; border-color: var(--primary); background: white; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1); }

                /* Reports & Crisis Management Styles */
                .sub-tab-nav { background: #f1f5f9; padding: 4px; border-radius: 14px; display: flex; gap: 4px; }
                .sub-tab-btn { border: none; background: transparent; padding: 0.6rem 1.2rem; border-radius: 10px; font-size: 0.85rem; font-weight: 700; color: var(--text-muted); cursor: pointer; transition: all 0.2s; white-space: nowrap; }
                .sub-tab-btn.active { background: white; color: var(--primary); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }

                .case-badge { background: #e0e7ff; color: #4338ca; padding: 0.3rem 0.6rem; border-radius: 8px; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.5px; }
                .case-badge.gray { background: #f1f5f9; color: #64748b; }

                .reason-pill { padding: 0.3rem 0.7rem; border-radius: 20px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; }
                .reason-pill.scam { background: #fee2e2; color: #ef4444; }
                .reason-pill.harassment { background: #ffedd5; color: #f97316; }
                .reason-pill.spam { background: #f3f4f6; color: #6b7280; }
                .reason-pill.other { background: #e0f2fe; color: #0ea5e9; }

                .evidence-preview { max-width: 250px; font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                .control-btn { border: none; background: #f1f5f9; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; color: #64748b; }
                .control-btn:hover { transform: translateY(-2px); filter: brightness(0.95); }
                .control-btn.chat { color: var(--primary); background: var(--primary-light); }
                .control-btn.ban { color: #ef4444; background: #fee2e2; }
                .control-btn.warn { color: #d97706; background: #fef3c7; }
                .control-btn.dismiss { color: #10b981; background: #d1fae5; }
                
                .action-divider { width: 1px; height: 24px; background: #e2e8f0; margin: 0 4px; align-self: center; }

                .verdict-pill { padding: 0.4rem 0.8rem; border-radius: 30px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; }
                .verdict-pill.ban { background: #ef4444; color: white; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2); }
                .verdict-pill.warning { background: #fef3c7; color: #d97706; border: 1px solid #fde68a; }
                .verdict-pill.none { background: #f1f5f9; color: #64748b; }

                /* New Management Styles */
                .search-box { position: relative; display: flex; align-items: center; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 0 1rem; width: 300px; }
                .search-box input { border: none; background: transparent; padding: 0.8rem; outline: none; width: 100%; font-weight: 600; color: var(--text-main); }
                .search-box svg { color: #94a3b8; }
                
                .filter-select { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 0.8rem 1rem; font-weight: 700; color: var(--text-main); outline: none; cursor: pointer; transition: all 0.2s; }
                .filter-select:focus { border-color: var(--primary); background: white; }

                .status-badge { padding: 0.3rem 0.6rem; border-radius: 8px; font-size: 0.7rem; font-weight: 900; }
                .status-badge.active { background: #dcfce7; color: #16a34a; }
                .status-badge.banned { background: #fee2e2; color: #ef4444; }

                .action-btn.info { color: #3b82f6; background: rgba(59, 130, 246, 0.05); }
                .action-btn.info:hover { background: #3b82f6; color: white; }

                /* Modal Styles */
                .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.3); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease-out; }
                .info-modal { background: white; width: 100%; max-width: 500px; border-radius: 24px; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15); position: relative; animation: slideUp 0.3s ease-out; }
                
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

                .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-top: 1.5rem; }
                .info-item { display: flex; flex-direction: column; gap: 0.4rem; }
                .info-label { font-size: 0.7rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                .info-value { font-size: 0.95rem; color: var(--text-main); font-weight: 700; }
            `}</style>

            {/* User Info Modal */}
            {selectedUserInfo && (
                <div className="modal-overlay" onClick={() => setSelectedUserInfo(null)}>
                    <div className="info-modal" onClick={e => e.stopPropagation()}>
                        <button 
                            className="action-btn" 
                            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: '#f1f5f9' }}
                            onClick={() => setSelectedUserInfo(null)}
                        >
                            <X size={18} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <UserIcon size={32} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>{selectedUserInfo.name}</h3>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                                    <span className={`role-badge ${selectedUserInfo.role.toLowerCase()}`}>{selectedUserInfo.role}</span>
                                    <span className={`status-badge ${selectedUserInfo.isBanned ? 'banned' : 'active'}`}>
                                        {selectedUserInfo.isBanned ? 'BANNED' : 'ACTIVE'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="info-grid">
                            <div className="info-item">
                                <div className="info-label"><Phone size={12} /> Phone Number</div>
                                <div className="info-value">{selectedUserInfo.phoneNumber || 'Not Linked'}</div>
                            </div>
                            <div className="info-item">
                                <div className="info-label"><Bell size={12} /> Email Address</div>
                                <div className="info-value" style={{ fontSize: '0.85rem' }}>{selectedUserInfo.email}</div>
                            </div>
                            <div className="info-item">
                                <div className="info-label"><MapPin size={12} /> Current Residence</div>
                                <div className="info-value">{selectedUserInfo.profile?.city || 'Unknown'}, {selectedUserInfo.profile?.state || 'N/A'}</div>
                            </div>
                            <div className="info-item">
                                <div className="info-label"><Briefcase size={12} /> Occupation</div>
                                <div className="info-value">{selectedUserInfo.profile?.occupation || 'Not Specified'}</div>
                            </div>
                        </div>

                        {selectedUserInfo.profile?.bio && (
                            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '16px' }}>
                                <div className="info-label" style={{ marginBottom: '0.5rem' }}>User Bio</div>
                                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5', color: '#475569' }}>{selectedUserInfo.profile.bio}</p>
                            </div>
                        )}

                        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                            <button 
                                className="btn-primary" 
                                style={{ flex: 1, padding: '0.8rem' }}
                                onClick={() => {
                                    handleOfficialMessage(selectedUserInfo.id);
                                    setSelectedUserInfo(null);
                                }}
                            >
                                Send Official DM
                            </button>
                            <button 
                                className="action-btn" 
                                style={{ padding: '0 1.5rem', background: selectedUserInfo.isBanned ? '#dcfce7' : '#fee2e2', color: selectedUserInfo.isBanned ? '#16a34a' : '#ef4444', width: 'auto' }}
                                onClick={() => {
                                    handleBanUser(selectedUserInfo.id, selectedUserInfo.isBanned);
                                    setSelectedUserInfo(null);
                                }}
                            >
                                {selectedUserInfo.isBanned ? 'Unban User' : 'Ban User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
