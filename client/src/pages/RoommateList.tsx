import React, { useEffect, useState } from 'react';
import api, { API_BASE } from '../api/client';
import { MapPin, IndianRupee, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useSocket } from '../context/SocketContext';

interface Profile {
    id: number;
    location?: string;
    state?: string;
    city?: string;
    budgetMin?: number;
    budgetMax?: number;
    occupation?: string;
    gender?: string;
    lifestyle?: string;
    bio?: string;
    userId: number; // Ensure we track userId to match socket event
    avatar?: string;
    showAvatarPublicly?: boolean;
    user: {
        id: number;
        name: string;
        email: string;
        role: string;
        phoneNumber?: string;
    };
}

const RoommateList: React.FC = () => {
    const { socket } = useSocket();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRoommates = async () => {
            try {
                const { data } = await api.get('/users/roommates');
                setProfiles(data);
            } catch (error) {
                console.error('Failed to fetch roommates', error);
            } finally {
                setLoading(false);
            }
        };
        fetchRoommates();
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleProfileUpdated = (updatedData: any) => {
            setProfiles(prev => prev.map(p => {
                // The profile API returns structure { ..., user: { id, name ... } }
                // But the userId in profile is p.userId.
                // We need to match either p.userId or p.user.id with updatedData.userId
                if (p.userId === updatedData.userId || p.user.id === updatedData.userId) {
                    return {
                        ...p,
                        // Update flattened profile fields if passed in event (avatar, showAvatarPublicly)
                        avatar: updatedData.avatar !== undefined ? updatedData.avatar : p.avatar,
                        showAvatarPublicly: updatedData.showAvatarPublicly !== undefined ? updatedData.showAvatarPublicly : p.showAvatarPublicly,
                        user: {
                            ...p.user,
                            name: updatedData.name || p.user.name,
                            phoneNumber: updatedData.phoneNumber || p.user.phoneNumber,
                        }
                    };
                }
                return p;
            }));
        };

        const handleUserStatusChanged = ({ userId, isBanned }: any) => {
            if (isBanned) {
                setProfiles(prev => prev.filter(p => String(p.userId) !== String(userId) && String(p.user.id) !== String(userId)));
            }
        };

        const handleUserDeleted = (data: any) => {
            const userId = data && typeof data === 'object' ? data.userId : data;
            setProfiles(prev => prev.filter(p => String(p.userId) !== String(userId) && String(p.user.id) !== String(userId)));
        };

        socket.on('profileUpdated', handleProfileUpdated);
        socket.on('userStatusChanged_Admin', handleUserStatusChanged);
        socket.on('userDeleted', handleUserDeleted);
        return () => {
            socket.off('profileUpdated', handleProfileUpdated);
            socket.off('userStatusChanged_Admin', handleUserStatusChanged);
            socket.off('userDeleted', handleUserDeleted);
        };
    }, [socket]);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading roommates...</div>;

    return (
        <div className="container animate-fade-in" style={{ padding: 'clamp(1rem, 5vw, 3rem) 1rem' }}>
            <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
                <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', color: 'var(--primary)', fontWeight: 800, margin: '0 0 1rem' }}>Find Your Roommate</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>Connect with like-minded individuals looking for a home.</p>
            </div>

            {profiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '5rem 1rem', background: 'rgba(255,255,255,0.5)', borderRadius: '24px', border: '2px dashed var(--glass-border)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏠</div>
                    <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>No profiles found yet. Be the first to join!</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(280px, 100%, 350px), 1fr))',
                    gap: '2rem'
                }}>
                    {profiles.map((p) => (
                        <div key={p.id} className="glass-panel profile-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '1.5rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', marginBottom: '1.5rem' }}>
                                    <div className="avatar">
                                        {p.avatar && p.showAvatarPublicly !== false ? (
                                            <img
                                                src={`${API_BASE}${p.avatar}`}
                                                alt={p.user.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '18px' }}
                                            />
                                        ) : (
                                            (p.user.name || 'U').charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div style={{ overflow: 'hidden' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.user.name}</h3>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>{p.occupation || 'Explorer'}</div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gap: '0.8rem', marginBottom: '2rem' }}>
                                    <div className="spec-item">
                                        <MapPin size={18} className="icon" />
                                        <span>{p.city ? `${p.city}${p.state ? `, ${p.state}` : ''}` : (p.location || 'Flexible Location')}</span>
                                    </div>
                                    <div className="spec-item">
                                        <IndianRupee size={18} className="icon" />
                                        <span>₹{p.budgetMin || 0} - {p.budgetMax || 'Any'}</span>
                                    </div>
                                    <div className="spec-item">
                                        <Briefcase size={18} className="icon" />
                                        <span style={{ fontSize: '0.85rem' }}>{p.lifestyle || 'Quiet & Clean'}</span>
                                    </div>
                                </div>

                                <div style={{ marginTop: 'auto' }}>
                                    <Link to="/chat" className="btn-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.8rem', borderRadius: '12px', textDecoration: 'none', fontWeight: 700 }}>
                                        Connect Now
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                .profile-card {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 1px solid var(--glass-border);
                }
                .profile-card:hover {
                    transform: translateY(-8px);
                    border-color: var(--primary);
                    box-shadow: 0 12px 30px rgba(79, 70, 229, 0.1);
                }
                .avatar {
                    width: 56px;
                    height: 56px;
                    border-radius: 18px;
                    background: linear-gradient(135deg, var(--primary), #818cf8);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    font-weight: 800;
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
                    flex-shrink: 0;
                }
                .spec-item {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    color: var(--text-muted);
                    font-weight: 500;
                    font-size: 0.9rem;
                }
                .spec-item .icon {
                    color: var(--primary);
                    opacity: 0.7;
                    flex-shrink: 0;
                }
            `}</style>
        </div>
    );
};

export default RoommateList;
