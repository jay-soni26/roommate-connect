import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/client';
import { MapPin, Users, IndianRupee, ChevronLeft, ChevronRight, Image as ImageIcon, X, Eye, Heart, Search, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Room {
    id: number;
    postingType: string;
    title: string;
    location: string;
    state?: string;
    city?: string;
    rentPerPerson: number;
    capacity: number;
    currentOccupancy: number;
    description: string;
    propertyType?: string;
    images?: string; 
    ownerId: number;
    owner: { name: string };
    isFavorited?: boolean;
}

const RoomCard: React.FC<{
    room: Room;
    API_BASE: string;
    onMessage: (id: number) => void;
    onZoom: (url: string) => void;
    onViewDetails: (room: Room) => void;
    onToggleFavorite: (id: number) => void;
}> = ({ room, API_BASE, onMessage, onZoom, onViewDetails, onToggleFavorite }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPulsing, setIsPulsing] = useState(false);

    const getImages = (room: Room) => {
        if (!room.images) return [];
        try {
            const parsed = JSON.parse(room.images);
            return Array.isArray(parsed) ? parsed.map((url: string) => url.startsWith('http') ? url : (url.startsWith('/') ? `${API_BASE}${url}` : `${API_BASE}/${url}`)) : [];
        } catch (e) { return []; }
    };

    const images = getImages(room);

    return (
        <div className="glass-panel room-card animate-fade-in" style={{ padding: '0', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '200px', width: '100%', position: 'relative', overflow: 'hidden' }}>
                <img 
                    src={images[0] || 'https://via.placeholder.com/400x300?text=No+Image'} 
                    alt={room.title} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => images.length > 0 && onZoom(images[0])}
                />
                
                <button
                    onClick={(e) => { e.stopPropagation(); setIsPulsing(true); setTimeout(() => setIsPulsing(false), 300); onToggleFavorite(room.id); }}
                    style={{
                        position: 'absolute', top: '0.8rem', right: '0.8rem', width: '36px', height: '36px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
                        background: 'rgba(239, 68, 68, 0.9)', color: 'white', backdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)', zIndex: 5, animation: isPulsing ? 'heartPop 0.3s' : 'none'
                    }}
                >
                    <Heart size={18} fill="white" />
                </button>
                
                <div style={{ position: 'absolute', bottom: '0.8rem', left: '0.8rem', background: 'rgba(255, 255, 255, 0.9)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {room.propertyType}
                </div>
            </div>

            <div style={{ padding: '1.2rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{room.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.8rem' }}>
                    <MapPin size={14} /> {room.location}, {room.city}
                </div>

                <div style={{ marginTop: 'auto' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--text-main)', marginBottom: '1rem' }}>
                        ₹{room.rentPerPerson}<span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/mo</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                        <button onClick={() => onViewDetails(room)} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.6rem' }}>Details</button>
                        <button onClick={() => onMessage(room.ownerId)} className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.6rem' }}>Message</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FavoritesPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const API_BASE = `http://${window.location.hostname}:3000`;

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        fetchFavorites();
    }, [user]);

    const fetchFavorites = async () => {
        try {
            const { data } = await api.get('/rooms/my-favorites');
            setRooms(data);
        } catch (error) {
            console.error('Fetch favorites failed', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleFavorite = async (id: number) => {
        try {
            await api.post('/rooms/toggle-favorite', { roomId: id });
            setRooms(prev => prev.filter(r => r.id !== id));
        } catch (e) { console.error(e); }
    };

    if (loading) return <div style={{ padding: '5rem', textAlign: 'center' }}>Loading your collection...</div>;

    return (
        <div className="container animate-fade-in" style={{ padding: '2rem 1rem' }}>
            <button onClick={() => navigate('/rooms')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', marginBottom: '1.5rem', padding: 0 }}>
                <ArrowLeft size={20} /> Back to Search
            </button>

            <header style={{ marginBottom: '3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                        <Heart size={24} fill="currentColor" />
                    </div>
                    <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-main)' }}>My Favorites</h1>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', fontWeight: 500 }}>
                    You have saved {rooms.length} room{rooms.length !== 1 ? 's' : ''} to your collection.
                </p>
            </header>

            {rooms.length === 0 ? (
                <div className="glass-panel" style={{ padding: '5rem 2rem', textAlign: 'center', borderRadius: '32px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1.5rem', opacity: 0.5 }}>📂</div>
                    <h2 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>Your collection is empty</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem auto' }}>
                        Browse rooms and click the heart icon to save listings you're interested in.
                    </p>
                    <button onClick={() => navigate('/rooms')} className="btn-primary" style={{ padding: '1rem 2.5rem', borderRadius: '16px' }}>
                        Explore Rooms
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
                    {rooms.map(room => (
                        <RoomCard 
                            key={room.id} 
                            room={room} 
                            API_BASE={API_BASE} 
                            onMessage={(id) => navigate('/chat', { state: { activeChatId: id } })}
                            onZoom={setZoomedImage}
                            onViewDetails={(r) => navigate(`/rooms?highlight=${r.id}`)}
                            onToggleFavorite={handleToggleFavorite}
                        />
                    ))}
                </div>
            )}

            {zoomedImage && createPortal(
                <div className="zoom-overlay" onClick={() => setZoomedImage(null)}>
                    <div className="zoom-content">
                        <img src={zoomedImage} alt="Zoomed" />
                        <button className="zoom-close" onClick={() => setZoomedImage(null)}><X size={24} /></button>
                    </div>
                </div>,
                document.body
            )}

            <style>{`
                @keyframes heartPop {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.4); }
                    100% { transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default FavoritesPage;
