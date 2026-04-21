import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/client';
import { MapPin, Users, IndianRupee, ChevronLeft, ChevronRight, Image as ImageIcon, X, Eye, Search, SlidersHorizontal, ArrowUpDown, Shield } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { RoomSkeleton } from '../components/Skeleton';
import { toast } from 'react-hot-toast';

import { getStates, getCitiesByState } from '../data/indianStatesAndCities';

interface Room {
    id: number;
    postingType: string;
    title: string;
    location: string;
    state?: string;
    city?: string;
    address?: string;
    rentPerPerson: number;
    capacity: number;
    currentOccupancy: number;
    description: string;
    propertyType?: string;
    furnishing?: string;
    genderPreference?: string;
    lookingFor?: string;
    images?: string; // JSON string of urls
    ownerId: number;
    owner: { name: string };
    isFavorited?: boolean;
    createdAt: string;
}


const RoomCard: React.FC<{
    room: Room;
    API_BASE: string;
    isAdmin?: boolean;
    onMessage: (id: number) => void;
    onZoom: (url: string) => void;
    onViewDetails: (room: Room) => void;
    onToggleFavorite: (id: number) => void;
    onAdminDelete?: (id: number) => void;
}> = ({ room, API_BASE, isAdmin, onMessage, onZoom, onViewDetails, onToggleFavorite, onAdminDelete }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPulsing, setIsPulsing] = useState(false);

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsPulsing(true);
        setTimeout(() => setIsPulsing(false), 300);
        onToggleFavorite(room.id);
    };


    const getImages = (room: Room) => {
        if (!room.images) return [];
        try {
            const parsed = JSON.parse(room.images);
            const imagesArray = Array.isArray(parsed) ? parsed : [];
            // Map images to ensure full URLs for external links
            return imagesArray.map((url: string) =>
                url.startsWith('http') ? url : (url.startsWith('/') ? `${API_BASE}${url}` : `${API_BASE}/${url}`)
            );
        } catch (e) {
            return [];
        }
    };

    const images = getImages(room);

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    return (
        <div className="glass-panel room-card" style={{ padding: '0', overflow: 'hidden', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Image Display */}
            <div
                style={{ height: '230px', width: '100%', background: '#f3f4f6', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => images.length > 0 && onZoom(images[currentIndex])}
            >
                {images.length > 0 ? (
                    <>
                        <img
                            key={currentIndex}
                            src={images[currentIndex]}
                            alt={`${room.title} - ${currentIndex + 1}`}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                animation: 'fadeIn 0.4s ease'
                            }}
                        />

                        <div className="image-overlay-hint">
                            <Eye size={20} />
                            <span>Click to Zoom</span>
                        </div>

                        {images.length > 1 && (
                            <>
                                <button onClick={prevImage} className="nav-btn left">
                                    <ChevronLeft size={20} />
                                </button>
                                <button onClick={nextImage} className="nav-btn right">
                                    <ChevronRight size={20} />
                                </button>

                                <div className="dots-container">
                                    {images.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`dot ${idx === currentIndex ? 'active' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                                        />
                                    ))}
                                </div>
                            </>
                        )}


                    </>
                ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: '0.5rem' }}>
                        <ImageIcon size={40} opacity={0.3} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>No Images Available</span>
                    </div>
                )}

                <div style={{
                    position: 'absolute',
                    top: '1rem',
                    left: '1rem',
                    background: 'rgba(79, 70, 229, 0.9)',
                    color: 'white',
                    padding: '0.3rem 0.8rem',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    backdropFilter: 'blur(4px)',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                    zIndex: 2
                }}>
                    {room.postingType}
                </div>

                {/* HEART BUTTON - ADVANCED STYLE */}
                <button
                    onClick={handleFavoriteClick}
                    className={`favorite-btn ${room.isFavorited ? 'active' : ''} ${isPulsing ? 'pulse' : ''}`}
                    style={{
                        position: 'absolute',
                        top: '0.8rem',
                        right: '0.8rem',
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        cursor: 'pointer',
                        zIndex: 10,
                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        background: room.isFavorited ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.2)',
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        color: room.isFavorited ? '#ef4444' : 'white',
                    }}
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill={room.isFavorited ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ filter: room.isFavorited ? 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.4))' : 'none' }}
                    >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>

                {room.propertyType && (
                    <span style={{
                        position: 'absolute',
                        bottom: '1rem',
                        right: '1rem',
                        background: 'rgba(255, 255, 255, 0.95)',
                        color: 'var(--primary)',
                        padding: '0.4rem 1rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 2
                    }}>
                        {room.propertyType}
                    </span>
                )}
            </div>

            <div style={{ padding: '1.5rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: '1.3' }}>{room.title}</h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                    <MapPin size={16} color="var(--primary)" /> {room.location}{room.city ? `, ${room.city}` : ''}{room.state ? `, ${room.state}` : ''}
                </div>

                <div style={{ marginTop: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem', marginBottom: '1.2rem' }}>
                        <IndianRupee size={18} color="var(--primary)" strokeWidth={3} />
                        <span style={{ fontWeight: 900, fontSize: '1.6rem', color: 'var(--text-main)' }}>{room.rentPerPerson}</span>
                        <small style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>/mo</small>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', padding: '0.8rem', background: 'rgba(0,0,0,0.02)', borderRadius: '12px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                            <Users size={16} /> {room.currentOccupancy}/{room.capacity} Slots
                        </span>
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>@{room.owner.name}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                        <button
                            onClick={() => onViewDetails(room)}
                            className="btn-secondary"
                            style={{ fontSize: '0.9rem', fontWeight: 700, padding: '0.8rem', borderRadius: '12px', border: '2px solid var(--primary)', color: 'var(--primary)', background: 'transparent' }}
                        >
                            Details
                        </button>
                        <button
                            onClick={() => onMessage(room.ownerId)}
                            className="btn-primary"
                            style={{ fontSize: '0.9rem', fontWeight: 700, padding: '0.8rem', borderRadius: '12px' }}
                        >
                            Message
                        </button>
                    </div>

                    {isAdmin && onAdminDelete && (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #fca5a5' }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); onAdminDelete(room.id); }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#fee2e2', color: '#ef4444', fontWeight: 800, padding: '0.8rem', border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                                ADMIN: DELETE Listing
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const RoomList: React.FC = () => {
    const { user, isBanned } = useAuth();
    const { socket } = useSocket();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [detailImageIndex, setDetailImageIndex] = useState(0);
    const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [sortOption, setSortOption] = useState('newest');
    const [searchParams] = useSearchParams();

    // Filter States
    const [filters, setFilters] = useState({
        search: '',
        state: '',
        city: '',
        minPrice: '',
        maxPrice: '',
        propertyType: '',
        genderPreference: '',
        furnishing: ''
    });

    const navigate = useNavigate();
    const API_BASE = `http://${window.location.hostname}:3000`;

    // Fetch rooms and user preferences
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [roomsRes, profileRes] = await Promise.all([
                    api.get('/rooms'),
                    user ? api.get('/users/profile').catch(() => ({ data: null })) : Promise.resolve({ data: null })
                ]);

                const roomsData = roomsRes.data.data || roomsRes.data;
                setRooms(roomsData);

                // Check for URL params first (from "Find Matching Rooms" button or Notification)
                const urlHighlight = searchParams.get('highlight');

                if (urlHighlight) {
                    const roomToHighlight = roomsData.find((r: Room) => r.id === Number(urlHighlight));
                    if (roomToHighlight) {
                        setSelectedRoom(roomToHighlight);
                    }
                }

                const urlState = searchParams.get('state');
                const urlCity = searchParams.get('city');
                const urlMaxPrice = searchParams.get('maxPrice');
                const urlPropertyType = searchParams.get('propertyType');
                const urlGender = searchParams.get('genderPreference');

                if (urlState || urlCity || urlMaxPrice || urlPropertyType || urlGender) {
                    setFilters(prev => ({
                        ...prev,
                        state: urlState || prev.state,
                        city: urlCity || prev.city,
                        maxPrice: urlMaxPrice || prev.maxPrice,
                        propertyType: urlPropertyType || prev.propertyType,
                        genderPreference: urlGender || prev.genderPreference,
                    }));
                }
                // Fallback to User Profile defaults if no params
                else if (profileRes.data?.state) {
                    setFilters(prev => ({ ...prev, state: profileRes.data.state }));
                }
            } catch (error) {
                console.error('Failed to fetch data', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user, searchParams]);

    // Filtering Logic
    useEffect(() => {
        let result = rooms.filter(room => room.postingType === 'OFFERING');

        // Search Bar (Title, Description, Area)
        if (filters.search) {
            const query = filters.search.toLowerCase();
            result = result.filter(r =>
                r.title.toLowerCase().includes(query) ||
                r.description.toLowerCase().includes(query) ||
                r.location.toLowerCase().includes(query)
            );
        }

        // Location Filters
        if (filters.state) {
            result = result.filter((r: Room) => r.state === filters.state);
        }
        if (filters.city) {
            result = result.filter((r: Room) => r.city === filters.city);
        }

        // Price Filters
        if (filters.minPrice) {
            result = result.filter((r: Room) => r.rentPerPerson >= Number(filters.minPrice));
        }
        if (filters.maxPrice) {
            result = result.filter((r: Room) => r.rentPerPerson <= Number(filters.maxPrice));
        }

        // Property Specifications
        if (filters.propertyType) {
            result = result.filter((r: Room) => r.propertyType === filters.propertyType);
        }
        if (filters.genderPreference) {
            result = result.filter((r: Room) => r.genderPreference === filters.genderPreference || r.genderPreference === 'Any');
        }
        if (filters.furnishing) {
            result = result.filter((r: Room) => r.furnishing === filters.furnishing);
        }

        // Sorting
        if (sortOption === 'price-low') {
            result.sort((a: Room, b: Room) => a.rentPerPerson - b.rentPerPerson);
        } else if (sortOption === 'price-high') {
            result.sort((a: Room, b: Room) => b.rentPerPerson - a.rentPerPerson);
        } else {
            // Newest first - using actual createdAt timestamp
            result.sort((a: Room, b: Room) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        setFilteredRooms(result);
    }, [rooms, filters, sortOption]);

    useEffect(() => {
        if (!socket) return;

        const handleRoomCreated = (newRoom: Room) => {
            if (user && newRoom.ownerId === user.id) return;
            setRooms(prev => {
                if (prev.find(r => r.id === newRoom.id)) return prev;
                return [newRoom, ...prev];
            });
        };

        const handleRoomUpdated = (updatedRoom: Room) => {
            setRooms(prev => prev.map(r => r.id === updatedRoom.id ? updatedRoom : r));
        };

        const handleRoomDeleted = (data: any) => {
            const idToRemove = data && typeof data === 'object' ? data.id : data;
            setRooms(prev => prev.filter(r => String(r.id) !== String(idToRemove)));
        };

        socket.on('roomCreated', handleRoomCreated);
        socket.on('roomUpdated', handleRoomUpdated);
        socket.on('roomDeleted', handleRoomDeleted);

        return () => {
            socket.off('roomCreated', handleRoomCreated);
            socket.off('roomUpdated', handleRoomUpdated);
            socket.off('roomDeleted', handleRoomDeleted);
        };
    }, [socket, user]);

    const handleMessageOwner = async (ownerId: number) => {
        try {
            const { data } = await api.post('/chats/start', { partnerId: ownerId });
            navigate('/chat', { state: { activeChatId: data.id } });
        } catch (error) {
            console.error('Failed to start chat', error);
            alert('Could not start chat. Please login first.');
        }
    };

    const handleAdminDelete = async (id: number) => {
        if (!window.confirm('Admin Action: Are you sure you want to permanently delete this room?')) return;
        try {
            await api.delete(`/admin/rooms/${id}`);
            // Instant local removal
            setRooms(prev => prev.filter(r => String(r.id) !== String(id)));
        } catch (error) {
            console.error('Failed to delete room as admin', error);
            alert('Failed to delete room');
        }
    };

    if (isBanned) {
        return (
            <div style={{ padding: '4rem 1rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }} className="animate-fade-in restricted-allow">
                <div style={{ background: '#fee2e2', padding: '2rem', borderRadius: '24px', border: '2px solid #fecaca' }}>
                    <Shield size={64} color="#ef4444" style={{ marginBottom: '1.5rem' }} />
                    <h2 style={{ color: '#991b1b', marginBottom: '1rem', fontWeight: 800 }}>Feed Access Restricted</h2>
                    <p style={{ color: '#b91c1c', lineHeight: 1.6, marginBottom: '2rem' }}>
                        Your account has been detected with suspicious activity and restricted. You can no longer view public room listings.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button onClick={() => navigate('/chat')} className="btn-primary">
                            Contact Support
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="container" style={{ padding: '2rem 1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(280px, 100%, 350px), 1fr))', gap: '2.5rem' }}>
                    {[1, 2, 3, 4, 5, 6].map(i => <RoomSkeleton key={i} />)}
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="container animate-fade-in" style={{ padding: '2rem 1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
                        <div style={{ flex: '1 1 300px' }}>
                            <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)', fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 900, lineHeight: 1.2 }}>Available Rooms</h2>
                            <p style={{ color: 'var(--text-muted)', margin: 0, fontWeight: 500, fontSize: '1.1rem' }}>Find the perfect place to call home</p>
                        </div>
                        {user && (
                            <button onClick={() => navigate('/post-room')} className="btn-primary" style={{ padding: '1rem 2rem', borderRadius: '18px', fontSize: '1rem', fontWeight: 700, boxShadow: '0 4px 15px rgba(var(--primary-rgb), 0.3)' }}>
                                Post a Room
                            </button>
                        )}
                    </div>

                    {/* Unified Professional Search & Filter Bar */}
                    <div className="search-filter-container">
                        <div className="search-main-row">
                            <div className="search-input-wrapper">
                                <Search size={20} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search by area, title or keywords..."
                                    value={filters.search}
                                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                    className="search-input-field"
                                />
                            </div>

                            <div className="filter-controls-group">
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
                                >
                                    <SlidersHorizontal size={18} />
                                    <span>Filters</span>
                                </button>

                                <div className="sort-select-wrapper">
                                    <select
                                        value={sortOption}
                                        onChange={(e) => setSortOption(e.target.value)}
                                        className="sort-select"
                                    >
                                        <option value="newest">Newest First</option>
                                        <option value="price-low">Price: Low-High</option>
                                        <option value="price-high">Price: High-Low</option>
                                    </select>
                                    <ArrowUpDown size={16} className="sort-icon" />
                                </div>
                            </div>
                        </div>

                        {showFilters && (
                            <div className="filter-drawer">
                                <div className="filter-group">
                                    <label>Location: State</label>
                                    <select
                                        value={filters.state}
                                        onChange={(e) => setFilters({ ...filters, state: e.target.value, city: '' })}
                                        className="filter-input"
                                    >
                                        <option value="">All over India</option>
                                        {getStates().map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                <div className="filter-group">
                                    <label>Location: City</label>
                                    <select
                                        value={filters.city}
                                        onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                                        disabled={!filters.state}
                                        className="filter-input"
                                        style={{ opacity: filters.state ? 1 : 0.6 }}
                                    >
                                        <option value="">All Cities</option>
                                        {filters.state && getCitiesByState(filters.state).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                <div className="filter-group">
                                    <label>Max Price (₹)</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 15000"
                                        value={filters.maxPrice}
                                        onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                                        className="filter-input"
                                        style={{ appearance: 'textfield' }}
                                    />
                                </div>

                                <div className="filter-group">
                                    <label>Gender Preference</label>
                                    <select
                                        value={filters.genderPreference}
                                        onChange={(e) => setFilters({ ...filters, genderPreference: e.target.value })}
                                        className="filter-input"
                                    >
                                        <option value="">Any Gender</option>
                                        <option value="Male">Male Only</option>
                                        <option value="Female">Female Only</option>
                                    </select>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                    <label style={{ visibility: 'hidden' }}>Reset</label>
                                    <button
                                        onClick={() => setFilters({ search: '', state: '', city: '', minPrice: '', maxPrice: '', propertyType: '', genderPreference: '', furnishing: '' })}
                                        style={{
                                            width: '100%',
                                            height: '40px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: '#ef444410',
                                            color: '#ef4444',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            transition: 'all 0.2s',
                                            marginTop: 'auto'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#ef444420'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#ef444410'}
                                    >
                                        Reset All
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {filteredRooms.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏠</div>
                            <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>No rooms found.</h3>
                            <p style={{ color: 'var(--text-muted)' }}>Be the first to post a room in this area!</p>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(280px, 100%, 350px), 1fr))',
                            gap: '2.5rem'
                        }}>
                            {filteredRooms.map((room) => (
                                <RoomCard
                                    key={room.id}
                                    room={room}
                                    API_BASE={API_BASE}
                                    isAdmin={user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'}
                                    onMessage={handleMessageOwner}
                                    onZoom={setZoomedImage}
                                    onViewDetails={setSelectedRoom}
                                    onToggleFavorite={async (id) => {
                                        if (!user) {
                                            navigate('/login');
                                            return;
                                        }
                                        try {
                                            const { data } = await api.post('/rooms/toggle-favorite', { roomId: id });
                                            setRooms(prev => prev.map(r => r.id === id ? { ...r, isFavorited: data.action === 'added' } : r));
                                        } catch (e) {
                                            console.error('Favorite toggle failed', e);
                                        }
                                    }}
                                    onAdminDelete={handleAdminDelete}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Zoom Modal */}
                {zoomedImage && createPortal(
                    <div
                        className="zoom-overlay"
                        onClick={() => setZoomedImage(null)}
                    >
                        <div className="zoom-content" onClick={(e) => e.stopPropagation()}>
                            <img src={zoomedImage} alt="Zoomed Room" />
                            <button className="zoom-close" onClick={() => setZoomedImage(null)}>
                                <X size={24} />
                            </button>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Details Modal */}
                {selectedRoom && createPortal(
                    <div className="details-overlay" onClick={() => { setSelectedRoom(null); setDetailImageIndex(0); }}>
                        <div className="details-content" onClick={e => e.stopPropagation()}>
                            <button className="details-close" onClick={() => { setSelectedRoom(null); setDetailImageIndex(0); }}>
                                <X size={28} />
                            </button>

                            <div className="details-scroll-area">
                                <div className="details-grid-layout">
                                    <div className="details-image-wrapper">
                                        <div className="details-image-container">
                                            {selectedRoom.images ? (
                                                (() => {
                                                    const modalImages = JSON.parse(selectedRoom.images);
                                                    return (
                                                        <>
                                                            <img
                                                                src={modalImages[detailImageIndex].startsWith('http') ? modalImages[detailImageIndex] : `${API_BASE}${modalImages[detailImageIndex]}`}
                                                                alt={selectedRoom.title}
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'all 0.4s ease' }}
                                                            />
                                                            {modalImages.length > 1 && (
                                                                <>
                                                                    <button
                                                                        className="modal-nav-btn left"
                                                                        onClick={() => setDetailImageIndex(prev => (prev - 1 + modalImages.length) % modalImages.length)}
                                                                    >
                                                                        <ChevronLeft size={24} />
                                                                    </button>
                                                                    <button
                                                                        className="modal-nav-btn right"
                                                                        onClick={() => setDetailImageIndex(prev => (prev + 1) % modalImages.length)}
                                                                    >
                                                                        <ChevronRight size={24} />
                                                                    </button>
                                                                    <div className="modal-dots">
                                                                        {modalImages.map((_: any, idx: number) => (
                                                                            <div
                                                                                key={idx}
                                                                                className={`modal-dot ${idx === detailImageIndex ? 'active' : ''}`}
                                                                                onClick={() => setDetailImageIndex(idx)}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </>
                                                    );
                                                })()
                                            ) : (
                                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                                                    <ImageIcon size={64} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Side - Content */}
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <span style={{ background: 'var(--primary)', color: 'white', padding: '0.3rem 1rem', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem', display: 'inline-block' }}>{selectedRoom.postingType}</span>
                                            <h2 className="details-title">{selectedRoom.title}</h2>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                <MapPin size={18} color="var(--primary)" />
                                                {selectedRoom.location}, {selectedRoom.city}, {selectedRoom.state}
                                            </div>
                                        </div>

                                        <div className="details-tags-row">
                                            <div className="detail-tag"><b>Rent:</b> ₹{selectedRoom.rentPerPerson}/mo</div>
                                            <div className="detail-tag"><b>Type:</b> {selectedRoom.propertyType || 'N/A'}</div>
                                            <div className="detail-tag"><b>Furnishing:</b> {selectedRoom.furnishing || 'N/A'}</div>
                                            <div className="detail-tag"><b>Preference:</b> {selectedRoom.lookingFor || 'Any'}</div>
                                        </div>

                                        <div style={{ marginBottom: '2rem' }}>
                                            <h4 style={{ color: 'var(--text-main)', marginBottom: '0.8rem', fontSize: '1rem', fontWeight: 800 }}>Exact Address</h4>
                                            <div style={{ padding: '1.2rem', background: 'rgba(79, 70, 229, 0.05)', borderRadius: '16px', border: '1px solid rgba(79, 70, 229, 0.1)', color: 'var(--text-main)', fontWeight: 500, lineHeight: 1.6 }}>
                                                {selectedRoom.address || 'Address is available upon contact.'}
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: '2.5rem' }}>
                                            <h4 style={{ color: 'var(--text-main)', marginBottom: '0.8rem', fontSize: '1rem', fontWeight: 800 }}>About this Listing</h4>
                                            <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, margin: 0 }}>{selectedRoom.description}</p>
                                        </div>

                                        <div className="details-owner-row">
                                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', minWidth: 0 }}>
                                                <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', flexShrink: 0 }}>
                                                    {selectedRoom.owner.name.charAt(0)}
                                                </div>
                                                <div style={{ overflow: 'hidden' }}>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Owner</div>
                                                    <div style={{ color: 'var(--text-main)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedRoom.owner.name}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { handleMessageOwner(selectedRoom.ownerId); setSelectedRoom(null); }}
                                                className="btn-primary"
                                                style={{ padding: '0.8rem 1.5rem', borderRadius: '14px', fontWeight: 800, flexShrink: 0 }}
                                            >
                                                Message Owner
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Bottom Bar (Fixed) */}
                            <div className="details-mobile-footer">
                                <button
                                    onClick={() => { handleMessageOwner(selectedRoom.ownerId); setSelectedRoom(null); }}
                                    className="btn-primary"
                                    style={{ width: '100%', padding: '1.2rem', borderRadius: '16px', fontWeight: 800, fontSize: '1.1rem' }}
                                >
                                    Message Owner
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                <ZoomStyles />
            </div>
        </>
    );
};

export default RoomList;

function ZoomStyles() {
    return (
        <style>{`
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes heartPop {
                0% { transform: scale(1); }
                50% { transform: scale(1.3); }
                100% { transform: scale(1); }
            }

            .favorite-btn:hover {
                transform: scale(1.1);
                background: rgba(255, 255, 255, 0.3) !important;
            }

            .favorite-btn.pulse {
                animation: heartPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }

            .favorite-btn.active {
                background: rgba(239, 68, 68, 0.2) !important;
            }

            /* Unified Professional Search & Filter Bar */
            .search-filter-container {
                background: white;
                padding: 0.5rem;
                border-radius: 16px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
                border: 1px solid rgba(0, 0, 0, 0.05);
                margin-bottom: 2.5rem;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .search-main-row {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                align-items: center;
                width: 100%;
            }

            .search-input-wrapper {
                position: relative;
                flex: 1 1 300px;
                display: flex;
                align-items: center;
                background: #f8fafc;
                border-radius: 12px;
                border: 1px solid #e2e8f0;
                transition: all 0.2s ease;
            }

            .search-input-wrapper:focus-within {
                background: white;
                border-color: var(--primary);
                box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
            }

            .search-icon {
                margin-left: 1rem;
                color: #64748b;
            }

            .search-input-field {
                flex: 1;
                padding: 0.7rem 1rem;
                border: none;
                background: transparent;
                font-size: 0.95rem;
                font-weight: 500;
                height: 48px;
                color: #1e293b;
                outline: none;
            }

            .filter-controls-group {
                display: flex;
                gap: 0.5rem;
                flex: 0 1 auto;
            }

            .filter-toggle-btn, .sort-select-wrapper {
                height: 48px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                color: #1e293b;
                font-weight: 600;
                transition: all 0.2s ease;
                cursor: pointer;
            }

            .filter-toggle-btn {
                padding: 0 1.2rem;
                gap: 0.6rem;
            }

            .filter-toggle-btn:hover, .sort-select-wrapper:hover {
                background: #f1f5f9;
                border-color: #cbd5e1;
            }

            .filter-toggle-btn.active {
                background: var(--primary);
                color: white;
                border-color: var(--primary);
            }

            .sort-select-wrapper {
                position: relative;
                min-width: 160px;
                padding: 0 0.8rem;
            }

            .sort-select {
                width: 100%;
                appearance: none;
                background: transparent;
                border: none;
                height: 100%;
                font-size: 0.9rem;
                font-weight: 600;
                color: inherit;
                cursor: pointer;
                outline: none;
                padding-right: 2rem;
            }

            .sort-icon {
                position: absolute;
                right: 1rem;
                pointer-events: none;
                color: #64748b;
            }

            /* Filter Drawer Styling */
            .filter-drawer {
                background: #f8fafc;
                border-radius: 12px;
                padding: 1.5rem;
                margin-top: 0.5rem;
                border: 1px solid #e2e8f0;
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 1.2rem;
                animation: slideDown 0.3s ease-out;
            }

            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .filter-group label {
                display: block;
                font-size: 0.75rem;
                font-weight: 700;
                color: #64748b;
                margin-bottom: 0.5rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                white-space: nowrap;
            }

            .filter-input {
                width: 100%;
                height: 40px;
                padding: 0 0.8rem;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
                background: white;
                font-size: 0.9rem;
                font-weight: 500;
                color: #1e293b;
                outline: none;
                transition: border-color 0.2s;
            }

            .filter-input:focus {
                border-color: var(--primary);
            }

            /* Mobile Optimizations */
            .filter-input::-webkit-outer-spin-button,
            .filter-input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            .filter-input[type=number] {
                -moz-appearance: textfield;
            }

            @media (max-width: 640px) {
                .search-filter-container {
                    padding: 0.4rem;
                }
                .search-input-wrapper {
                    flex: 1 1 100%;
                }
                .filter-controls-group {
                    width: 100%;
                    gap: 0.4rem;
                }
                .filter-toggle-btn, .sort-select-wrapper {
                    flex: 1;
                    height: 44px;
                    font-size: 0.85rem;
                }
                .filter-toggle-btn {
                    padding: 0 0.8rem;
                }
                .filter-drawer {
                    padding: 1rem;
                    grid-template-columns: 1fr 1fr;
                }
            }

            .room-card:hover {
                transform: translateY(-8px);
                border-color: var(--primary);
                box-shadow: 0 20px 40px rgba(79, 70, 229, 0.12);
            }
            
            .image-overlay-hint {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.3);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: white;
                opacity: 0;
                transition: opacity 0.3s;
                gap: 0.5rem;
            }

            .room-card:hover .image-overlay-hint {
                opacity: 1;
            }

            .image-overlay-hint span {
                font-size: 0.8rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            


            .nav-btn {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                background: rgba(255, 255, 255, 0.9);
                border: none;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                color: var(--primary);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                opacity: 0;
                transition: all 0.2s;
                z-index: 5;
            }
            
            .room-card:hover .nav-btn {
                opacity: 1;
            }
            
            .nav-btn.left { left: 10px; }
            .nav-btn.right { right: 10px; }
            .nav-btn:hover { background: white; transform: translateY(-50%) scale(1.1); color: var(--primary-hover); }
            
            .dots-container {
                position: absolute;
                bottom: 12px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 6px;
                z-index: 5;
            }
            
            .dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.4);
                cursor: pointer;
                transition: all 0.2s;
                border: 1px solid rgba(0,0,0,0.1);
            }
            
            .dot.active {
                background: white;
                transform: scale(1.2);
                box-shadow: 0 0 8px rgba(0,0,0,0.2);
                width: 20px;
                border-radius: 4px;
            }

            .zoom-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2147483647; 
                padding: 2rem;
                animation: fadeIn 0.3s ease;
            }

            .zoom-content {
                position: relative;
                max-width: 95vw;
                max-height: 95vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .zoom-content img {
                max-width: 100%;
                max-height: 95vh;
                object-fit: contain;
                border-radius: 4px;
                border: 4px solid white;
                animation: zoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            }

            .zoom-close {
                position: fixed;
                top: 25px;
                right: 25px;
                background: white;
                border: none;
                width: 45px;
                height: 45px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
                transition: all 0.2s;
                z-index: 2147483647;
                color: black;
            }

            @keyframes zoomIn {
                from { transform: scale(0.9); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }

            /* Professional Details Modal Styles */
            .details-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(15, 23, 42, 0.85);
                backdrop-filter: blur(12px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 3000;
                padding: 2rem;
                animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                box-sizing: border-box;
            }

            .details-content {
                width: 100%;
                max-width: 700px;
                max-height: 92dvh;
                background: white;
                border-radius: 40px;
                position: relative;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-shadow: 0 50px 100px -20px rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.2);
                box-sizing: border-box;
            }

            .details-scroll-area {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 2.5rem;
                padding-top: 1.5rem;
                width: 100%;
                box-sizing: border-box;
            }

            .details-image-wrapper {
                position: relative;
                width: 100%;
            }

            .details-image-container {
                height: 400px;
                border-radius: 24px;
                overflow: hidden;
                background: #f1f5f9;
                border: 1px solid #e2e8f0;
                position: relative;
            }

            .details-title {
                font-size: 2rem;
                font-weight: 900;
                color: var(--text-main);
                margin: 0 0 0.5rem 0;
                line-height: 1.2;
            }

            .details-grid-layout {
                display: block;
                width: 100%;
            }

            .details-close {
                position: absolute;
                top: 1.5rem;
                right: 1.5rem;
                background: white;
                border: none;
                width: 48px;
                height: 48px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                color: #1e293b;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 100;
            }

            .details-close:hover {
                background: #ef4444;
                color: white;
                transform: rotate(90deg) scale(1.1);
            }

            /* Modal Image Navigation */
            .modal-nav-btn {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                background: rgba(255, 255, 255, 0.9);
                border: none;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                color: var(--primary);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                transition: all 0.2s;
                z-index: 10;
            }

            .modal-nav-btn:hover { background: white; transform: translateY(-50%) scale(1.1); }
            .modal-nav-btn.left { left: 1rem; }
            .modal-nav-btn.right { right: 1rem; }

            .modal-dots {
                position: absolute;
                bottom: 1.5rem;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 8px;
                z-index: 10;
            }

            .modal-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.5);
                cursor: pointer;
                transition: all 0.2s;
            }

            .modal-dot.active {
                background: white;
                width: 24px;
                border-radius: 4px;
            }

            .details-owner-row {
                margin-top: 2rem; 
                padding: 1.2rem; 
                background: #f8fafc; 
                border-radius: 20px; 
                display: flex; 
                align-items: center; 
                justify-content: space-between; 
                gap: 1.5rem;
                border: 1px solid #f1f5f9;
                width: 100%;
            }

            .details-tags-row {
                display: flex;
                flex-wrap: wrap;
                gap: 1.2rem;
                margin-bottom: 2.5rem;
                padding: 1.8rem;
                background: #f8fafc;
                border-radius: 28px;
                border: 1px solid #e2e8f0;
            }

            .detail-tag {
                background: white;
                padding: 0.8rem 1.4rem;
                border-radius: 16px;
                font-size: 0.95rem;
                color: var(--text-main);
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                border: 1px solid #e2e8f0;
                display: flex;
                align-items: center;
            }

            .detail-tag b {
                color: var(--primary);
                margin-right: 0.6rem;
                font-weight: 800;
            }

            .details-mobile-footer {
                display: none;
                padding: 1.5rem;
                background: white;
                border-top: 1px solid #f1f5f9;
            }

            @media (max-width: 950px) {
                .details-overlay {
                    padding: 0;
                }
                .details-content {
                    max-height: 100dvh;
                    height: 100dvh;
                    border-radius: 0;
                    width: 100%;
                }
                .details-scroll-area {
                    padding: 1.2rem;
                    padding-bottom: 7rem;
                    padding-top: 5rem;
                    width: 100%;
                }
                .details-image-container {
                    height: 280px;
                    border-radius: 20px;
                }
                .details-title {
                    font-size: 1.6rem;
                }
                .details-grid-layout {
                    grid-template-columns: 1fr;
                    gap: 1.5rem;
                }
                .details-owner-row {
                    display: none;
                }
                .details-mobile-footer {
                    display: block;
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: 110;
                    box-shadow: 0 -10px 20px rgba(0,0,0,0.05);
                    padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));
                }
                .details-close {
                    top: 1rem;
                    right: 1rem;
                    width: 48px;
                    height: 48px;
                    background: white;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    position: fixed;
                    z-index: 2001;
                }
                .modal-nav-btn {
                    width: 36px;
                    height: 36px;
                }
            }
        `}</style>
    );
}
