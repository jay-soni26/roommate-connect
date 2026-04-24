import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api, { API_BASE } from '../api/client';
import { MapPin, Users, IndianRupee, Home, ChevronLeft, ChevronRight, Eye, X, Search, SlidersHorizontal, ArrowUpDown, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getStates, getCitiesByState } from '../data/indianStatesAndCities';
import { RoomSkeleton } from '../components/Skeleton';
import { toast } from 'react-hot-toast';

interface RoomSeeker {
    id: number;
    postingType: string;
    title: string;
    description: string;
    location: string;
    state?: string;
    city?: string;
    rentPerPerson: number;
    capacity: number;
    propertyType?: string;
    furnishing?: string;
    genderPreference?: string;
    images?: string; // JSON string of urls
    ownerId: number;
    owner: { name: string };
    createdAt: string;
}

const SeekerCard: React.FC<{
    seeker: RoomSeeker;
    API_BASE: string;
    isAdmin?: boolean;
    onContact: (id: number) => void;
    onZoom: (url: string) => void;
    onViewDetails: (seeker: RoomSeeker) => void;
    onAdminDelete?: (id: number) => void;
}> = ({ seeker, API_BASE, isAdmin, onContact, onZoom, onViewDetails, onAdminDelete }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const getImages = (item: RoomSeeker) => {
        if (!item.images) return [];
        try {
            const parsed = JSON.parse(item.images);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    };

    const images = getImages(seeker);

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    return (
        <div className="glass-panel seeker-card" style={{ padding: '0', overflow: 'hidden', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Image Section (Optional for Seekers) */}
            {images.length > 0 && (
                <div
                    style={{ height: '200px', width: '100%', background: '#f3f4f6', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                    onClick={() => onZoom(`${API_BASE}${images[currentIndex]}`)}
                >
                    <img
                        key={currentIndex}
                        src={`${API_BASE}${images[currentIndex]}`}
                        alt={`${seeker.title} - ${currentIndex + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', animation: 'fadeIn 0.4s ease' }}
                    />

                    <div className="image-overlay-hint">
                        <Eye size={18} />
                        <span>Zoom</span>
                    </div>

                    {images.length > 1 && (
                        <>
                            <button onClick={prevImage} className="nav-btn left">
                                <ChevronLeft size={18} />
                            </button>
                            <button onClick={nextImage} className="nav-btn right">
                                <ChevronRight size={18} />
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
                </div>
            )}

            <div style={{ padding: '1.5rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem', gap: '1rem' }}>
                    <h3 style={{ margin: '0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: '1.4' }}>{seeker.title}</h3>
                    <span className="badge-seeking">🔍 Seeking</span>
                </div>

                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                    {seeker.description.substring(0, 100)}{seeker.description.length > 100 ? '...' : ''}
                </p>

                <div style={{ marginTop: 'auto' }}>
                    <div className="spec-grid-compact">
                        <div className="spec-item-compact">
                            <MapPin size={14} /> {seeker.location}{seeker.city ? `, ${seeker.city}` : ''}{seeker.state ? `, ${seeker.state}` : ''}
                        </div>
                        {seeker.propertyType && <div className="spec-item-compact"><Home size={14} /> {seeker.propertyType}</div>}
                        <div className="spec-item-compact"><Users size={14} /> {seeker.capacity} {seeker.capacity === 1 ? 'person' : 'people'}</div>
                    </div>

                    <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--primary)', margin: '1rem 0' }}>
                        <IndianRupee size={18} /> {seeker.rentPerPerson}<small style={{ fontSize: '0.8rem', fontWeight: 500 }}>/mo budget</small>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.2rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Posted by: <b>{seeker.owner.name}</b></span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                        <button
                            onClick={() => onViewDetails(seeker)}
                            className="btn-secondary"
                            style={{ fontSize: '0.9rem', fontWeight: 700, padding: '0.8rem', borderRadius: '12px', border: '2px solid var(--primary)', color: 'var(--primary)', background: 'transparent' }}
                        >
                            Details
                        </button>
                        <button
                            onClick={() => onContact(seeker.ownerId)}
                            className="btn-primary"
                            style={{ fontSize: '0.9rem', fontWeight: 700, padding: '0.8rem', borderRadius: '12px' }}
                        >
                            Contact
                        </button>
                    </div>

                    {isAdmin && onAdminDelete && (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #fca5a5' }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); onAdminDelete(seeker.id); }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#fee2e2', color: '#ef4444', fontWeight: 800, padding: '0.8rem', border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                                ADMIN: DELETE Request
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const FindRoommates: React.FC = () => {
    const { user, isBanned } = useAuth();
    const { socket } = useSocket();
    const [seekers, setSeekers] = useState<RoomSeeker[]>([]);
    const [loading, setLoading] = useState(true);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [selectedSeeker, setSelectedSeeker] = useState<RoomSeeker | null>(null);
    const [filteredSeekers, setFilteredSeekers] = useState<RoomSeeker[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [sortOption, setSortOption] = useState('newest');

    // Filter States
    const [filters, setFilters] = useState({
        search: '',
        state: '',
        city: '',
        maxPrice: '',
        propertyType: '',
        genderPreference: ''
    });

    const navigate = useNavigate();

    // const API_BASE removed (using imported)

    // Fetch data and preferences
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [roomsRes, profileRes] = await Promise.all([
                    api.get('/rooms'),
                    user ? api.get('/users/profile').catch(() => ({ data: null })) : Promise.resolve({ data: null })
                ]);

                const rawData = roomsRes.data.data || roomsRes.data;
                const allSeekers = Array.isArray(rawData) ? rawData.filter((room: RoomSeeker) => room.postingType === 'SEEKING') : [];
                setSeekers(allSeekers);

                // Set initial state filter from user profile if available
                if (profileRes.data?.state) {
                    setFilters(prev => ({ ...prev, state: profileRes.data.state }));
                }
            } catch (error) {
                console.error('Failed to fetch data', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    // Filtering Logic
    useEffect(() => {
        let result = [...seekers];

        // Search Bar (Title, Description, Area)
        if (filters.search) {
            const query = filters.search.toLowerCase();
            result = result.filter(s =>
                s.title.toLowerCase().includes(query) ||
                s.description.toLowerCase().includes(query) ||
                s.location.toLowerCase().includes(query)
            );
        }

        // Location Filters
        if (filters.state) {
            result = result.filter((s: RoomSeeker) => s.state === filters.state);
        }
        if (filters.city) {
            result = result.filter((s: RoomSeeker) => s.city === filters.city);
        }

        // Budget Filter
        if (filters.maxPrice) {
            result = result.filter((s: RoomSeeker) => s.rentPerPerson <= Number(filters.maxPrice));
        }

        // Specifications
        if (filters.propertyType) {
            result = result.filter((s: RoomSeeker) => s.propertyType === filters.propertyType);
        }
        if (filters.genderPreference) {
            result = result.filter((s: RoomSeeker) => s.genderPreference === filters.genderPreference || s.genderPreference === 'Any');
        }

        // Sorting
        if (sortOption === 'price-low') {
            result.sort((a: RoomSeeker, b: RoomSeeker) => a.rentPerPerson - b.rentPerPerson);
        } else if (sortOption === 'price-high') {
            result.sort((a: RoomSeeker, b: RoomSeeker) => b.rentPerPerson - a.rentPerPerson);
        } else {
            // Newest first - using actual createdAt timestamp
            result.sort((a: RoomSeeker, b: RoomSeeker) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        setFilteredSeekers(result);
    }, [seekers, filters, sortOption]);

    useEffect(() => {
        if (!socket) return;

        const handleRoomCreated = (newRoom: RoomSeeker) => {
            if (newRoom.postingType === 'SEEKING') {
                if (user && newRoom.ownerId === user.id) return;
                setSeekers(prev => [newRoom, ...prev]);
            }
        };

        const handleRoomUpdated = (updatedRoom: RoomSeeker) => {
            if (updatedRoom.postingType === 'SEEKING') {
                setSeekers(prev => prev.map(r => r.id === updatedRoom.id ? updatedRoom : r));
            } else {
                setSeekers(prev => prev.filter(r => r.id !== updatedRoom.id));
            }
        };

        const handleRoomDeleted = (data: any) => {
            const idToRemove = data && typeof data === 'object' ? data.id : data;
            setSeekers(prev => prev.filter(r => String(r.id) !== String(idToRemove)));
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

    const handleContact = async (ownerId: number) => {
        if (!user) {
            toast.error('Please login to contact this person');
            navigate('/login');
            return;
        }

        if (user.id === ownerId) {
            toast.error('You cannot message yourself');
            return;
        }

        try {
            const { data } = await api.post('/chats/start', { partnerId: ownerId });
            navigate('/chat', { state: { activeChatId: data.id } });
        } catch (error: any) {
            console.error('Failed to start chat', error);
            const errMsg = error.response?.data?.error || 'Could not start chat. Please try again later.';
            toast.error(errMsg);
        }
    };

    const handleAdminDelete = async (id: number) => {
        if (!window.confirm('Admin Action: Are you sure you want to permanently delete this seeker request?')) return;
        try {
            await api.delete(`/admin/rooms/${id}`);
            // Instant local removal
            setSeekers(prev => prev.filter(r => String(r.id) !== String(id)));
        } catch (error) {
            console.error('Failed to delete seeker as admin', error);
            toast.error('Failed to delete seeker');
        }
    };

    if (isBanned) {
        return (
            <div style={{ padding: '4rem 1rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }} className="animate-fade-in restricted-allow">
                <div style={{ background: '#fee2e2', padding: '2rem', borderRadius: '24px', border: '2px solid #fecaca' }}>
                    <Shield size={64} color="#ef4444" style={{ marginBottom: '1.5rem' }} />
                    <h2 style={{ color: '#991b1b', marginBottom: '1rem', fontWeight: 800 }}>Roommates Access Restricted</h2>
                    <p style={{ color: '#b91c1c', lineHeight: 1.6, marginBottom: '2rem' }}>
                        Your account has been detected with suspicious activity and restricted. You can no longer view roommate seekers.
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(280px, 100%, 350px), 1fr))', gap: '2rem' }}>
                    {[1, 2, 3].map(i => <RoomSkeleton key={i} />)}
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
                            <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)', fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 900 }}>Explore Requests</h2>
                            <p style={{ color: 'var(--text-muted)', margin: 0, fontWeight: 500, fontSize: '1.1rem' }}>Find people looking for a place or a roommate</p>
                        </div>
                    </div>

                    {/* Unified Professional Search & Filter Bar */}
                    <div className="search-filter-container">
                        <div className="search-main-row">
                            <div className="search-input-wrapper">
                                <Search size={20} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search by area, interests or keywords..."
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
                                        <option value="price-low">Budget: Low-High</option>
                                        <option value="price-high">Budget: High-Low</option>
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
                                    <label>Max Budget (₹)</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 10000"
                                        value={filters.maxPrice}
                                        onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                                        className="filter-input"
                                        style={{ appearance: 'textfield' }}
                                    />
                                </div>

                                <div className="filter-group">
                                    <label>Prefer Gender</label>
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
                                        onClick={() => setFilters({ search: '', state: '', city: '', maxPrice: '', propertyType: '', genderPreference: '' })}
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

                    {filteredSeekers.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                            <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>No seekers found.</h3>
                            <p style={{ color: 'var(--text-muted)' }}>Check back later or post a room yourself!</p>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(280px, 100%, 350px), 1fr))',
                            gap: '2rem'
                        }}>
                            {filteredSeekers.map((seeker) => (
                                <SeekerCard
                                    key={seeker.id}
                                    seeker={seeker}
                                    API_BASE={API_BASE}
                                    isAdmin={user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'}
                                    onContact={handleMessageSeeker}
                                    onZoom={setZoomedImage}
                                    onViewDetails={setSelectedSeeker}
                                    onAdminDelete={handleAdminDelete}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {zoomedImage && createPortal(
                    <div className="zoom-overlay" onClick={() => setZoomedImage(null)}>
                        <div className="zoom-content" onClick={e => e.stopPropagation()}>
                            <img src={zoomedImage} alt="Zoomed" />
                            <button className="zoom-close" onClick={() => setZoomedImage(null)}><X size={24} /></button>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Details Modal */}
                {selectedSeeker && createPortal(
                    <div className="details-overlay" onClick={() => { setSelectedSeeker(null); }}>
                        <div className="details-content" onClick={e => e.stopPropagation()}>
                            <button className="details-close" onClick={() => { setSelectedSeeker(null); }}>
                                <X size={28} />
                            </button>

                            <div className="details-scroll-area">
                                {/* Seeker Details Content */}
                                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1rem' }}>
                                            <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.3rem 0.8rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>SEEKER</span>
                                        </div>
                                        <h2 className="details-title">{selectedSeeker.title}</h2>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '1rem' }}>
                                            <MapPin size={20} color="var(--primary)" />
                                            {selectedSeeker.location}, {selectedSeeker.city}, {selectedSeeker.state}
                                        </div>
                                    </div>

                                    <div className="details-tags-row">
                                        <div className="detail-tag"><b>Budget:</b> ₹{selectedSeeker.rentPerPerson}/mo</div>
                                        <div className="detail-tag"><b>Room Type:</b> {selectedSeeker.propertyType || 'Any'}</div>
                                        <div className="detail-tag"><b>Gender:</b> {selectedSeeker.genderPreference || 'Any'}</div>
                                        <div className="detail-tag"><b>People:</b> {selectedSeeker.capacity}</div>
                                    </div>

                                    <div style={{ marginBottom: '2rem' }}>
                                        <h4 style={{ color: 'var(--text-main)', marginBottom: '0.8rem', fontSize: '1.1rem', fontWeight: 800 }}>Search Details</h4>
                                        <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, margin: 0, fontSize: '1.05rem' }}>{selectedSeeker.description}</p>
                                    </div>

                                    <div className="details-owner-row">
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', minWidth: 0 }}>
                                            <div style={{ width: '50px', height: '50px', borderRadius: '15px', background: 'white', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.4rem', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', flexShrink: 0 }}>
                                                {selectedSeeker.owner.name.charAt(0)}
                                            </div>
                                            <div style={{ overflow: 'hidden' }}>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Posted by</div>
                                                <div style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedSeeker.owner.name}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { handleMessageSeeker(selectedSeeker.ownerId); setSelectedSeeker(null); }}
                                            className="btn-primary"
                                            style={{ padding: '0.8rem 1.5rem', borderRadius: '14px', fontWeight: 800, fontSize: '1rem', boxShadow: '0 10px 20px rgba(79, 70, 229, 0.2)', flexShrink: 0 }}
                                        >
                                            Contact Now
                                        </button>
                                    </div>
                                </div>

                                {/* Mobile Bottom Bar (Fixed) */}
                                <div className="details-mobile-footer">
                                    <button
                                        onClick={() => { handleMessageSeeker(selectedSeeker.ownerId); setSelectedSeeker(null); }}
                                        className="btn-primary"
                                        style={{ width: '100%', padding: '1.2rem', borderRadius: '16px', fontWeight: 800, fontSize: '1.1rem' }}
                                    >
                                        Contact Now
                                    </button>
                                </div>
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

export default FindRoommates;

function ZoomStyles() {
    return (
        <style>{`
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
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

            .seeker-card:hover {
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

            .seeker-card:hover .image-overlay-hint {
                opacity: 1;
            }

            .image-overlay-hint span {
                font-size: 0.8rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
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

            /* Details Modal Styles */
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
                z-index: 2000;
                padding: 2rem;
                animation: fadeIn 0.3s ease;
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
                box-shadow: 0 50px 100px -20px rgba(0,0,0,0.5);
            }

            .details-scroll-area {
                flex: 1;
                overflow-y: auto;
                padding: 2.5rem;
            }

            .details-title {
                font-size: 1.8rem;
                font-weight: 900;
                color: var(--text-main);
                margin: 0 0 0.5rem 0;
            }

            .details-close {
                position: absolute;
                top: 1.5rem;
                right: 1.5rem;
                background: #f8fafc;
                border: none;
                width: 48px;
                height: 48px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 100;
            }

            .details-owner-row {
                margin-top: 2rem;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-top: 1.5rem;
                border-top: 1px solid #f1f5f9;
            }

            .details-tags-row {
                display: flex;
                flex-wrap: wrap;
                gap: 1rem;
                margin-bottom: 2rem;
                padding: 1.5rem;
                background: #f8fafc;
                border-radius: 20px;
            }

            .detail-tag {
                background: white;
                padding: 0.6rem 1.2rem;
                border-radius: 12px;
                font-size: 0.9rem;
                border: 1px solid #f1f5f9;
            }

            .details-mobile-footer {
                display: none;
                padding: 1.5rem;
                background: white;
                border-top: 1px solid #f1f5f9;
            }

            @media (max-width: 900px) {
                .details-overlay { padding: 0; }
                .details-content { max-height: 100dvh; height: 100dvh; border-radius: 0; width: 100%; }
                .details-scroll-area { padding: 1.2rem; padding-bottom: 7rem; padding-top: 5rem; }
                .details-owner-row { display: none; }
                .details-mobile-footer {
                    display: block;
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: 110;
                    box-shadow: 0 -10px 20px rgba(0,0,0,0.05);
                }
                .details-close { position: fixed; top: 1rem; right: 1rem; background: white; z-index: 2001; }
            }
        `}</style>
    );
}
