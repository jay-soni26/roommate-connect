import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api, { API_BASE } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { User, List, Settings, MapPin, IndianRupee, Trash2, Edit2, Lock, Globe, Camera, X, Search, Bell } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useSocket } from '../context/SocketContext';
import { usePush } from '../context/PushContext';
import { getStates, getCitiesByState } from '../data/indianStatesAndCities';

interface Room {
    id: number;
    title: string;
    location: string;
    rentPerPerson: number;
    capacity: number;
    currentOccupancy: number;
    postingType: string;
}

const ProfilePage: React.FC = () => {
    const { user, logout, updateUser, isBanned } = useAuth();
    const navigate = useNavigate();
    const { language, setLanguage, t } = useLanguage();
    const { isSubscribed, subscribeUser, unsubscribeUser, isPushSupported } = usePush();
    const [activeTab, setActiveTab] = useState('profile');

    // Profile State
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        phoneNumber: '',
        email: '',
        address: '',
        occupation: '',
        budgetMin: '',
        budgetMax: '',
        location: '', // Legacy field, kept for backward compatibility
        state: '',
        city: '',
        preferredRoomType: '',
        gender: '',
        lifestyle: '',
        bio: '',
        avatar: '',
        showAvatarPublicly: true,
    });
    const [availableStates, setAvailableStates] = useState<string[]>([]);
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [loadingStates, setLoadingStates] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    // History State
    const [myRooms, setMyRooms] = useState<Room[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Settings State
    const [settingsTab, setSettingsTab] = useState('account');
    const [passLoading, setPassLoading] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        fetchProfile();
        loadStates();
    }, []);

    const loadStates = () => {
        setLoadingStates(true);
        try {
            const states = getStates();
            setAvailableStates(states);
        } catch (error) {
            console.error('Failed to load states', error);
        } finally {
            setLoadingStates(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'history') {
            fetchMyRooms();
        }
    }, [activeTab]);

    const fetchProfile = async () => {
        try {
            const { data } = await api.get('/users/profile');
            if (data) {
                setFormData({
                    name: data.user?.name || '',
                    phoneNumber: data.user?.phoneNumber || '',
                    email: data.user?.email || '',
                    address: data.address || '',
                    occupation: data.occupation || '',
                    budgetMin: data.budgetMin || '',
                    budgetMax: data.budgetMax || '',
                    location: data.location || '',
                    state: data.state || '',
                    city: data.city || '',
                    preferredRoomType: data.preferredRoomType || '',
                    gender: data.gender || '',
                    lifestyle: data.lifestyle || '',
                    bio: data.bio || '',
                    avatar: data.avatar || '',
                    showAvatarPublicly: data.showAvatarPublicly !== false,
                });
                // Load available cities based on saved state
                if (data.state) {
                    loadCitiesForState(data.state);
                }
            }
        } catch (error) {
            console.error('Failed to fetch profile', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyRooms = async () => {
        setHistoryLoading(true);
        try {
            const { data } = await api.get('/rooms/my-rooms');
            setMyRooms(data);
        } catch (error) {
            console.error('Failed to fetch my rooms');
        } finally {
            setHistoryLoading(false);
        }
    };

    const { socket } = useSocket();

    useEffect(() => {
        if (!socket) return;

        const handleRoomUpdated = (updatedRoom: any) => {
            setMyRooms(prev => prev.map(r => r.id === updatedRoom.id ? updatedRoom : r));
        };

        const handleRoomDeleted = (deletedRoomId: number) => {
            setMyRooms(prev => prev.filter(r => r.id !== deletedRoomId));
        };

        const handleProfileUpdated = (updatedData: any) => {
            if (user && updatedData.userId === user.id) {
                setFormData(prev => ({
                    ...prev,
                    ...updatedData,
                    avatar: updatedData.avatar ?? prev.avatar,
                    showAvatarPublicly: updatedData.showAvatarPublicly ?? prev.showAvatarPublicly
                }));
                // Also update global auth user context if needed, but updateUser does that.
                // We might want to call updateUser here too if we want the header avatar to update automatically without reload?
                // yes
                updateUser({
                    name: updatedData.name,
                    avatar: updatedData.avatar
                });
            }
        };

        socket.on('roomUpdated', handleRoomUpdated);
        socket.on('roomDeleted', handleRoomDeleted);
        socket.on('profileUpdated', handleProfileUpdated);

        return () => {
            socket.off('roomUpdated', handleRoomUpdated);
            socket.off('roomDeleted', handleRoomDeleted);
            socket.off('profileUpdated', handleProfileUpdated);
        };
    }, [socket, user, updateUser]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const uploadFormData = new FormData();
        uploadFormData.append('avatar', file);

        setAvatarLoading(true);
        try {
            const { data } = await api.post('/upload/profile-image', uploadFormData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Update profile with new avatar URL
            await api.put('/users/profile', { ...formData, avatar: data.url });

            updateUser({ avatar: data.url });
            setFormData(prev => ({ ...prev, avatar: data.url }));
            setMessage('Profile picture updated!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to upload image');
        } finally {
            setAvatarLoading(false);
        }
    };

    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const validateField = (name: string, value: string) => {
        let error = '';
        if (name === 'budgetMin' || name === 'budgetMax') {
            const num = Number(value);
            if (value && num < 0) error = 'Budget cannot be negative';

            // Cross-field validation
            if (name === 'budgetMin' && formData.budgetMax && num > Number(formData.budgetMax)) {
                error = 'Min budget cannot exceed Max';
            }
            if (name === 'budgetMax' && formData.budgetMin && num < Number(formData.budgetMin)) {
                error = 'Max budget cannot be less than Min';
            }
        } else if (name === 'phoneNumber') {
            const phoneRegex = /^[0-9+\s-]{10,15}$/;
            if (value && !phoneRegex.test(value)) error = 'Invalid phone number format';
        } else if (name === 'name') {
            if (value && value.trim().length < 2) error = 'Name is too short';
        }
        setFieldErrors(prev => ({ ...prev, [name]: error }));
    };

    const loadCitiesForState = (stateName: string) => {
        setLoadingCities(true);
        try {
            const cities = getCitiesByState(stateName);
            setAvailableCities(cities);
        } catch (error) {
            console.error('Failed to load cities', error);
        } finally {
            setLoadingCities(false);
        }
    };

    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        // Handle state change - update available cities
        if (name === 'state') {
            setFormData({ ...formData, [name]: value, city: '' }); // Reset city when state changes
            loadCitiesForState(value);
        } else {
            setFormData({ ...formData, [name]: value });
        }

        validateField(name, value);
    };

    const validateAll = () => {
        const errors: Record<string, string> = {};
        if (!formData.name || formData.name.trim().length < 2) errors.name = 'Name is required';
        if (!formData.phoneNumber) errors.phoneNumber = 'Phone number is required';

        const bMin = Number(formData.budgetMin);
        const bMax = Number(formData.budgetMax);
        if (formData.budgetMin && bMin < 0) errors.budgetMin = 'Cannot be negative';
        if (formData.budgetMax && bMax < 0) errors.budgetMax = 'Cannot be negative';
        if (formData.budgetMin && formData.budgetMax && bMin > bMax) {
            errors.budgetMin = 'Min exceeds Max';
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');

        if (!validateAll()) {
            setMessage('Please fix the errors before saving.');
            return;
        }

        try {
            await api.put('/users/profile', {
                ...formData,
                budgetMin: formData.budgetMin ? Number(formData.budgetMin) : null,
                budgetMax: formData.budgetMax ? Number(formData.budgetMax) : null,
            });
            updateUser({ name: formData.name, avatar: formData.avatar });
            setMessage('Profile updated successfully!');
            setTimeout(() => setMessage(''), 3000);
            fetchProfile();
        } catch (error: any) {
            setMessage(error.response?.data?.error || 'Failed to update profile.');
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage('New passwords do not match');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setMessage('Password must be at least 6 characters');
            return;
        }

        setPassLoading(true);
        try {
            await api.post('/users/change-password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });
            setMessage('Password updated successfully');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error: any) {
            setMessage(error.response?.data?.error || 'Failed to update password');
        } finally {
            setPassLoading(false);
        }
    };

    const handleDeleteRoom = async (roomId: number) => {
        if (!window.confirm('Are you sure you want to delete this listing? This cannot be undone.')) {
            return;
        }

        try {
            await api.delete(`/rooms/${roomId}`);
            setMyRooms(myRooms.filter(room => room.id !== roomId));
            setMessage('Listing deleted successfully');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Failed to delete room');
            toast.error('Failed to delete room');
        }
    };

    const sendTestPush = async () => {
        try {
            setMessage('Sending test pulse...');
            const { data } = await api.post('/push/test-push');
            setMessage('Perfect! ' + data.message);
        } catch (error: any) {
            if (error.response) {
                const errorMsg = error.response.data.message || 'Server Error';
                const detailMsg = error.response.data.error ? ` [${error.response.data.error}]` : '';
                setMessage('Error: ' + errorMsg + detailMsg);
            } else if (error.request) {
                setMessage('Error: Server Not Responding. Is your backend running?');
            } else {
                setMessage('Error: ' + error.message);
            }
        }
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm('Are you sure you want to delete your account? This will permanently remove all your data, listings, and messages. This action CANNOT be undone.')) {
            return;
        }

        const confirmText = window.prompt('Please type "DELETE" to confirm account deletion:');
        if (confirmText !== 'DELETE') {
            toast.error('Deletion cancelled: text did not match.');
            return;
        }

        try {
            await api.delete('/users/account');
            toast.success('Your account has been successfully deleted.');
            logout();
            navigate('/');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to delete account');
        }
    };

    const SidebarItem = ({ id, icon: Icon, label }: any) => (
        <div
            onClick={() => setActiveTab(id)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.8rem',
                padding: '1rem',
                cursor: 'pointer',
                borderRadius: '8px',
                background: activeTab === id ? 'var(--primary)' : 'transparent',
                color: activeTab === id ? 'white' : 'var(--text-main)',
                fontWeight: 500,
                marginBottom: '0.5rem',
                transition: 'all 0.2s'
            }}
        >
            <Icon size={20} />
            {label}
        </div>
    );

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading profile...</div>;

    return (
        <>
            <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }} className="animate-fade-in">
                <div className="profile-grid">
                    {/* Sidebar */}
                    <div className="glass-panel profile-sidebar" style={{ padding: '1.5rem', height: 'fit-content' }}>
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 1.5rem' }}>
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    background: 'white',
                                    borderRadius: '30px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)',
                                    overflow: 'hidden',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                    border: '2px solid white',
                                    cursor: formData.avatar ? 'zoom-in' : 'default'
                                }}
                                        onClick={() => {
                                            if (formData.avatar) setZoomedImage(formData.avatar.startsWith('http') ? formData.avatar : `${API_BASE}${formData.avatar}`);
                                        }}
                                    >
                                    {formData.avatar ? (
                                        <img src={formData.avatar.startsWith('http') ? formData.avatar : `${API_BASE}${formData.avatar}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <User size={50} />
                                    )}
                                </div>
                                <label style={{
                                    position: 'absolute',
                                    bottom: '-5px',
                                    right: '-5px',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    border: '3px solid white',
                                    transition: 'transform 0.2s'
                                }} className="camera-btn">
                                    <Camera size={18} />
                                    <input type="file" hidden accept="image/*" onChange={handleAvatarUpload} disabled={avatarLoading} />
                                </label>
                                {avatarLoading && <div className="avatar-loader"></div>}
                            </div>
                            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 800 }}>{formData.name || user?.name}</h3>
                            <span style={{ background: 'rgba(79, 70, 229, 0.1)', padding: '0.3rem 1rem', borderRadius: '12px', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>{user?.role}</span>
                        </div>

                        <div className="sidebar-nav">
                            <SidebarItem id="profile" icon={User} label={t('profile.edit')} />
                            <SidebarItem id="history" icon={List} label={t('profile.myListings')} />
                            <SidebarItem id="settings" icon={Settings} label={t('profile.settings')} />
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="glass-panel profile-content" style={{ padding: 'clamp(1.5rem, 5vw, 2.5rem)', position: 'relative' }}>
                        {activeTab === 'profile' && (
                            <>
                                <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', fontSize: 'clamp(1.2rem, 4vw, 1.8rem)' }}>{t('profile.edit')}</h2>
                                {message && <div style={{ padding: '1rem', background: '#d1fae5', color: '#065f46', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 500 }}>{message}</div>}

                                <form onSubmit={handleProfileSubmit}>
                                    {/* Personal Information Section */}
                                    <div style={{ marginBottom: '2.5rem' }}>
                                        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <div style={{ background: 'var(--primary)', color: 'white', padding: '0.4rem', borderRadius: '8px', display: 'flex' }}><User size={16} /></div> Personal Information {isBanned && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>(Read-Only)</span>}
                                        </h3>
                                        <div className={`input-grid ${isBanned ? 'restricted-mode' : ''}`}>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Full Name</label>
                                                <input name="name" className="input-field" style={{ borderColor: fieldErrors.name ? '#ef4444' : undefined }} value={formData.name} onChange={handleProfileChange} placeholder="John Doe" />
                                                {fieldErrors.name && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.2rem' }}>{fieldErrors.name}</div>}
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Mobile Number</label>
                                                <input name="phoneNumber" className="input-field" style={{ borderColor: fieldErrors.phoneNumber ? '#ef4444' : undefined }} value={formData.phoneNumber} onChange={handleProfileChange} placeholder="+91 9876543210" />
                                                {fieldErrors.phoneNumber && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.2rem' }}>{fieldErrors.phoneNumber}</div>}
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Email Address</label>
                                                <input name="email" className="input-field" value={formData.email} disabled style={{ background: '#f3f4f6', cursor: 'not-allowed', color: '#9ca3af' }} />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Profession / Occupation</label>
                                                <input name="occupation" className="input-field" value={formData.occupation} onChange={handleProfileChange} placeholder="e.g. Software Engineer" />
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '1.2rem' }}>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Address</label>
                                            <input name="address" className="input-field" value={formData.address} onChange={handleProfileChange} placeholder="123 Street, City, Country" />
                                        </div>
                                        <div style={{ marginTop: '1.2rem' }}>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Bio</label>
                                            <textarea name="bio" className="input-field" value={formData.bio} onChange={handleProfileChange} placeholder="Tell us about yourself..." style={{ minHeight: '100px', resize: 'vertical' }} />
                                        </div>
                                    </div>

                                    {/* Preferences Section */}
                                    <div style={{ marginBottom: '2rem' }}>
                                        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                                            <div style={{ background: 'var(--primary)', color: 'white', padding: '0.4rem', borderRadius: '8px', display: 'flex' }}><Settings size={16} /></div> Room Preferences {isBanned && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>(Read-Only)</span>}
                                        </h3>
                                        <div className={`input-grid ${isBanned ? 'restricted-mode' : ''}`}>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Min Budget (₹)</label>
                                                <input name="budgetMin" type="number" className="input-field" style={{ borderColor: fieldErrors.budgetMin ? '#ef4444' : undefined }} value={formData.budgetMin} onChange={handleProfileChange} placeholder="5000" />
                                                {fieldErrors.budgetMin && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.2rem' }}>{fieldErrors.budgetMin}</div>}
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Max Budget (₹)</label>
                                                <input name="budgetMax" type="number" className="input-field" style={{ borderColor: fieldErrors.budgetMax ? '#ef4444' : undefined }} value={formData.budgetMax} onChange={handleProfileChange} placeholder="20000" />
                                                {fieldErrors.budgetMax && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.2rem' }}>{fieldErrors.budgetMax}</div>}
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>State</label>
                                                <select name="state" className="input-field" value={formData.state} onChange={handleProfileChange} disabled={loadingStates}>
                                                    <option value="">{loadingStates ? 'Loading states...' : 'Select State'}</option>
                                                    {availableStates.map(state => (
                                                        <option key={state} value={state}>{state}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>City</label>
                                                <select
                                                    name="city"
                                                    className="input-field"
                                                    value={formData.city}
                                                    onChange={handleProfileChange}
                                                    disabled={!formData.state || loadingCities}
                                                    style={{ opacity: !formData.state || loadingCities ? 0.5 : 1 }}
                                                >
                                                    <option value="">
                                                        {loadingCities ? 'Loading cities...' : !formData.state ? 'Select State First' : 'Select City'}
                                                    </option>
                                                    {availableCities.map(city => (
                                                        <option key={city} value={city}>{city}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Room Type</label>
                                                <select name="preferredRoomType" className="input-field" value={formData.preferredRoomType} onChange={handleProfileChange}>
                                                    <option value="">Any</option>
                                                    <option value="Single Room">Single Room</option>
                                                    <option value="1RK">1RK</option>
                                                    <option value="1BHK">1BHK</option>
                                                    <option value="2BHK">2BHK</option>
                                                    <option value="3BHK+">3BHK+</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Gender</label>
                                                <select name="gender" className="input-field" value={formData.gender} onChange={handleProfileChange}>
                                                    <option value="">Any</option>
                                                    <option value="Male">Male</option>
                                                    <option value="Female">Female</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Lifestyle Tags</label>
                                                <input name="lifestyle" className="input-field" value={formData.lifestyle} onChange={handleProfileChange} placeholder="e.g. Non-Smoker, Night Owl" />
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className={isBanned ? 'restricted-mode' : ''}>
                                        <button type="submit" className="btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1rem', borderRadius: '12px' }} disabled={isBanned}>Save All Changes</button>
                                        <button
                                            type="button"
                                            disabled={isBanned}
                                            onClick={() => {
                                                const params = new URLSearchParams();
                                                if (formData.state) params.append('state', formData.state);
                                                if (formData.city) params.append('city', formData.city);
                                                if (formData.budgetMax) params.append('maxPrice', formData.budgetMax);
                                                if (formData.preferredRoomType && formData.preferredRoomType !== 'Any') params.append('propertyType', formData.preferredRoomType);
                                                if (formData.gender && formData.gender !== 'Any') params.append('genderPreference', formData.gender);

                                                navigate(`/rooms?${params.toString()}`);
                                            }}
                                            className="btn-secondary"
                                            style={{ width: '100%', padding: '1rem', fontSize: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', fontWeight: 700, border: '2px solid var(--primary)', color: 'var(--primary)', background: 'white' }}
                                        >
                                            <Search size={18} /> Find Matching Rooms
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}

                        {activeTab === 'history' && (
                            <>
                                <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', fontSize: 'clamp(1.2rem, 4vw, 1.8rem)' }}>{t('profile.myListings')}</h2>
                                {message && <div style={{ padding: '1rem', background: '#d1fae5', color: '#065f46', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{message}</div>}
                                {historyLoading ? <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading listings...</div> : (
                                    myRooms.length === 0 ? <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f9fafb', borderRadius: '16px' }}>
                                        <List size={40} style={{ color: '#d1d5db', marginBottom: '1rem' }} />
                                        <p style={{ color: 'var(--text-muted)', margin: 0 }}>You haven't posted any rooms yet.</p>
                                    </div> : (
                                        <div style={{ display: 'grid', gap: '1.2rem' }}>
                                            {myRooms.map(room => (
                                                <div key={room.id} className="listing-card" style={{ border: '1px solid var(--glass-border)', padding: '1.2rem', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.5)', transition: 'all 0.2s', flexWrap: 'wrap', gap: '1rem' }}>
                                                    <div style={{ flex: '1 1 300px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                                                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{room.title}</h3>
                                                            <span style={{
                                                                background: room.postingType === 'SEEKING' ? '#fef3c7' : '#dcfce7',
                                                                color: room.postingType === 'SEEKING' ? '#92400e' : '#166534',
                                                                padding: '0.2rem 0.6rem',
                                                                borderRadius: '8px',
                                                                fontSize: '0.65rem',
                                                                fontWeight: 800,
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.05em'
                                                            }}>
                                                                {room.postingType}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><MapPin size={14} /> {room.location}{(room as any).city ? `, ${(room as any).city}` : ''}{(room as any).state ? `, ${(room as any).state}` : ''}</span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: 600 }}><IndianRupee size={14} /> {room.rentPerPerson}</span>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }} className={isBanned ? 'restricted-mode' : ''}>
                                                        {room.postingType === 'OFFERING' && (
                                                            <div style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem', background: 'rgba(79, 70, 229, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '20px' }}>
                                                                {room.currentOccupancy}/{room.capacity} Occupied
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                                                            <button
                                                                onClick={() => navigate(`/edit-room/${room.id}`)}
                                                                className="action-btn edit"
                                                                title="Edit"
                                                                disabled={isBanned}
                                                            >
                                                                <Edit2 size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteRoom(room.id)}
                                                                className="action-btn delete"
                                                                title="Delete"
                                                                disabled={isBanned}
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}
                            </>
                        )}

                        {activeTab === 'settings' && (
                            <div className="settings-container">
                                {/* Settings Sidebar */}
                                <div className="settings-sidebar">
                                    <h3 style={{ marginBottom: '1.2rem', color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preferences</h3>
                                    <div className="settings-nav" style={{ paddingBottom: '0.5rem' }}>
                                        {[
                                            { id: 'account', label: t('settings.account'), icon: User },
                                            { id: 'security', label: t('settings.security'), icon: Lock },
                                            { id: 'notifications', label: 'Notifications', icon: Bell },
                                            { id: 'language', label: t('settings.language'), icon: Globe },
                                        ].map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={() => setSettingsTab(item.id)}
                                                className={`settings-tab ${settingsTab === item.id ? 'active' : ''}`}
                                            >
                                                <item.icon size={18} style={{ flexShrink: 0 }} />
                                                <span>{item.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Settings Content */}
                                <div className="settings-content">
                                    {settingsTab === 'account' && (
                                        <div className="animate-fade-in">
                                            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: 700 }}>{t('settings.account')}</h3>
                                            <div style={{ marginBottom: '2rem' }}>
                                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Email Address</label>
                                                <input className="input-field" value={user?.email} disabled style={{ background: '#f3f4f6', color: '#9ca3af' }} />
                                            </div>
                                            <div style={{ padding: '1.2rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid var(--glass-border)', marginBottom: '2rem' }}>
                                                <div className="setting-item-row">
                                                    <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
                                                        <h4 style={{ margin: '0 0 0.2rem', fontSize: '0.95rem', fontWeight: 700 }}>Profile Picture Visibility</h4>
                                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Show my profile picture to other users.</p>
                                                    </div>
                                                    <div
                                                        onClick={async () => {
                                                            const newVal = !formData.showAvatarPublicly;
                                                            setFormData({ ...formData, showAvatarPublicly: newVal });
                                                            try {
                                                                await api.put('/users/profile', { ...formData, showAvatarPublicly: newVal });
                                                                updateUser({ avatar: newVal ? formData.avatar : undefined }); // If hidden, maybe we hide in auth too? No, keep sync.
                                                            } catch (e) {
                                                                console.error(e);
                                                            }
                                                        }}
                                                        style={{
                                                            width: '50px',
                                                            height: '26px',
                                                            background: formData.showAvatarPublicly ? 'var(--primary)' : '#cbd5e1',
                                                            borderRadius: '20px',
                                                            position: 'relative',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.3s',
                                                            flexShrink: 0
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            background: 'white',
                                                            borderRadius: '50%',
                                                            position: 'absolute',
                                                            top: '3px',
                                                            left: formData.showAvatarPublicly ? '27px' : '3px',
                                                            transition: 'all 0.3s',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                        }} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ padding: '1.5rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.1)', marginTop: '2.5rem' }} className="restricted-allow">
                                                <h4 style={{ color: '#e11d48', marginTop: 0, marginBottom: '0.5rem', fontSize: '1rem', fontWeight: 700 }}>{t('settings.deleteAccount')}</h4>
                                                <p style={{ fontSize: '0.85rem', color: '#ef4444', marginBottom: '1.5rem', lineHeight: 1.6 }}>Permanently remove your account and all of your data. This action is irreversible.</p>
                                                <button
                                                    onClick={handleDeleteAccount}
                                                    style={{ background: '#e11d48', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
                                                >
                                                    Delete My Account
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {settingsTab === 'security' && (
                                        <div className={`animate-fade-in ${isBanned ? 'restricted-mode' : ''}`}>
                                            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: 700 }}>{t('settings.security')}</h3>
                                            <form onSubmit={handlePasswordChange}>
                                                <h4 style={{ marginBottom: '1.2rem', fontSize: '1rem', color: 'var(--text-main)', fontWeight: 600 }}>{t('settings.changePassword')}</h4>
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Current Password</label>
                                                    <input type="password" placeholder="••••••••" className="input-field" value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} disabled={isBanned} />
                                                </div>
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>New Password</label>
                                                    <input type="password" placeholder="••••••••" className="input-field" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} disabled={isBanned} />
                                                </div>
                                                <div style={{ marginBottom: '1.5rem' }}>
                                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Confirm New Password</label>
                                                    <input type="password" placeholder="••••••••" className="input-field" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} disabled={isBanned} />
                                                </div>
                                                <button type="submit" className="btn-primary" disabled={passLoading || isBanned} style={{ width: '100%', padding: '1rem', borderRadius: '12px' }}>
                                                    {passLoading ? 'Updating...' : 'Update Password'}
                                                </button>
                                                {message && <div style={{
                                                    marginTop: '1.5rem',
                                                    padding: '1rem',
                                                    borderRadius: '12px',
                                                    fontSize: '0.9rem',
                                                    textAlign: 'center',
                                                    fontWeight: 600,
                                                    background: message.toLowerCase().includes('success') ? '#d1fae5' : '#fee2e2',
                                                    color: message.toLowerCase().includes('success') ? '#065f46' : '#991b1b'
                                                }}>{message}</div>}
                                            </form>
                                        </div>
                                    )}

                                    {settingsTab === 'language' && (
                                        <div className="animate-fade-in">
                                            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: 700 }}>{t('settings.language')}</h3>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Preferred Interface Language</label>
                                                <div style={{ display: 'grid', gap: '1rem' }}>
                                                    {[
                                                        { id: 'en', label: '🇺🇸 English (US)' },
                                                        { id: 'hi', label: '🇮🇳 Hindi (हिंदी)' }
                                                    ].map((lang) => (
                                                        <div
                                                            key={lang.id}
                                                            onClick={() => setLanguage(lang.id as any)}
                                                            className={`lang-option ${language === lang.id ? 'active' : ''}`}
                                                        >
                                                            <span>{lang.label}</span>
                                                            {language === lang.id && <div className="dot" />}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {settingsTab === 'notifications' && (
                                        <div className="animate-fade-in">
                                            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: 700 }}>Notification Settings</h3>
                                            {!isPushSupported ? (
                                                <div style={{ padding: '1.5rem', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '16px', color: '#9a3412', fontSize: '0.9rem' }}>
                                                    Browser push notifications are not supported on your current device or browser.
                                                </div>
                                            ) : (
                                                <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                                                    <div className="setting-item-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <div style={{ flex: 1, paddingRight: '1rem' }}>
                                                            <h4 style={{ margin: '0 0 0.3rem', fontSize: '1rem', fontWeight: 700 }}>Browser Alerts</h4>
                                                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                                                Receive instant desktop and mobile notifications for new messages even when RoommateConnect is closed.
                                                            </p>
                                                        </div>
                                                        <div
                                                            onClick={() => isSubscribed ? unsubscribeUser() : subscribeUser()}
                                                            style={{
                                                                width: '56px',
                                                                height: '30px',
                                                                background: isSubscribed ? 'var(--primary)' : '#cbd5e1',
                                                                borderRadius: '20px',
                                                                position: 'relative',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                flexShrink: 0
                                                            }}
                                                        >
                                                            <div style={{
                                                                width: '22px',
                                                                height: '22px',
                                                                background: 'white',
                                                                borderRadius: '50%',
                                                                position: 'absolute',
                                                                top: '4px',
                                                                left: isSubscribed ? '30px' : '4px',
                                                                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                                                            }} />
                                                        </div>
                                                    </div>
                                                    
                                                    {!isSubscribed && (
                                                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                            <strong>Note:</strong> Enabling this will trigger a browser permission prompt. Ensure you click "Allow" to receive alerts.
                                                        </div>
                                                    )}

                                                    {isSubscribed && (
                                                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
                                                            <button 
                                                                onClick={sendTestPush}
                                                                className="btn-secondary"
                                                                style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', borderRadius: '10px', width: '100%', borderColor: 'var(--primary)', color: 'var(--primary)', marginBottom: '1rem' }}
                                                            >
                                                                Send Test Alert
                                                            </button>
                                                        </div>
                                                    )}

                                                    {message && (
                                                        <div style={{ 
                                                            padding: '0.8rem', 
                                                            background: message.includes('Perfect') || message.includes('sent') ? '#dcfce7' : '#fee2e2', 
                                                            color: message.includes('Perfect') || message.includes('sent') ? '#166534' : '#991b1b', 
                                                            borderRadius: '8px', 
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600,
                                                            wordBreak: 'break-all'
                                                        }}>
                                                            Status: {message}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <style>{`
                .profile-grid {
                    display: grid;
                    grid-template-columns: 280px 1fr;
                    gap: 2rem;
                    align-items: start;
                }
                @media (max-width: 900px) {
                    .profile-grid {
                        grid-template-columns: 1fr;
                        gap: 1.5rem;
                        width: 100%;
                        box-sizing: border-box;
                    }
                    .profile-sidebar {
                        margin-bottom: 0;
                        width: 100%;
                        box-sizing: border-box;
                    }
                    .profile-content {
                        padding: 1.5rem !important; /* Override clamp */
                        width: 100%;
                        box-sizing: border-box;
                        overflow-x: hidden;
                    }
                    .input-grid {
                        grid-template-columns: 1fr; /* Stack inputs on mobile */
                        gap: 1rem;
                    }
                    .listing-card {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    .listing-card > div {
                        width: 100%;
                    }
                }
                .listing-card:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                    border-color: var(--primary) !important;
                }
                .action-btn {
                    border: none;
                    padding: 0.6rem;
                    border-radius: 10px;
                    cursor: pointer;
                    display: flex;
                    transition: all 0.2s;
                }
                .action-btn.edit { background: #f3f4f6; color: #4b5563; }
                .action-btn.edit:hover { background: #e5e7eb; color: var(--primary); }
                .action-btn.delete { background: #fee2e2; color: #ef4444; }
                .action-btn.delete:hover { background: #fecaca; }
                
                .settings-container {
                    display: grid;
                    grid-template-columns: 200px 1fr;
                    gap: 2rem;
                }
                .settings-tab {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    padding: 0.8rem 1rem;
                    cursor: pointer;
                    border-radius: 10px;
                    color: var(--text-muted);
                    font-weight: 500;
                    margin-bottom: 0.4rem;
                    transition: all 0.2s;
                }
                .settings-tab:hover { background: rgba(0,0,0,0.02); }
                .settings-tab.active { background: white; color: var(--primary); box-shadow: 0 4px 6px rgba(0,0,0,0.05); font-weight: 700; }
                
                .lang-option {
                    padding: 1.2rem;
                    border-radius: 14px;
                    border: 2px solid var(--glass-border);
                    background: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    transition: all 0.2s;
                    font-weight: 500;
                    width: 100%; /* Ensure full width */
                    box-sizing: border-box;
                }
                .lang-option:hover { border-color: var(--primary); }
                .lang-option.active { border-color: var(--primary); background: rgba(79, 70, 229, 0.05); }
                .lang-option .dot { width: 12px; height: 12px; background: var(--primary); borderRadius: 50%; }

                .camera-btn:hover {
                    transform: scale(1.1);
                    background: var(--primary-hover);
                }
                
                .avatar-loader {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(255, 255, 255, 0.7);
                    borderRadius: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                }
                
                .avatar-loader::after {
                    content: "";
                    width: 30px;
                    height: 30px;
                    border: 3px solid #eef2ff;
                    border-top-color: var(--primary);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                @keyframes zoomIn {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }

                .setting-item-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                    width: 100%;
                }
                @media (max-width: 900px) {
                    .profile-grid {
                        grid-template-columns: 1fr;
                        gap: 1.5rem;
                        width: 100%;
                        box-sizing: border-box;
                    }
                    .setting-item-row {
                       /* Keep flex row but ensure text shrinks */
                       align-items: center;
                    }
                    /* Ensure text container shrinks properly */
                    .setting-item-row > div:first-child {
                        flex: 1 1 auto;
                        min-width: 0; /* Critical for text overflow */
                    }
                    .profile-sidebar {
                        margin-bottom: 0;
                        width: 100%;
                        box-sizing: border-box;
                        position: static !important; /* Reset sticky */
                    }
                    .profile-content {
                        padding: 1rem !important; /* Reduced padding for mobile */
                        width: 100%;
                        box-sizing: border-box;
                        overflow-x: hidden;
                    }
                    .input-grid {
                        grid-template-columns: 1fr;
                        gap: 1rem;
                    }
                    .settings-container { grid-template-columns: 1fr; }
                    .settings-sidebar { 
                        display: blockbox;
                        width: 100%;
                        border-right: none; 
                        border-bottom: 1px solid var(--glass-border); 
                        padding-bottom: 0.5rem; 
                        margin-bottom: 1.5rem;
                        overflow: hidden; /* Prevent container overflow */
                    }
                    .settings-nav { 
                        display: flex; 
                        gap: 0.8rem; 
                        overflow-x: auto; 
                        padding-bottom: 10px;
                        width: 100%;
                        -webkit-overflow-scrolling: touch;
                        scrollbar-width: none; /* Firefox */
                    }
                    .settings-nav::-webkit-scrollbar { display: none; } /* Chrome/Safari */
                    
                    .settings-tab { 
                        margin-bottom: 0; 
                        white-space: nowrap; 
                        flex-shrink: 0;
                        border: 1px solid var(--glass-border); /* Add border for visibility */
                        background: rgba(255,255,255,0.5);
                    }
                    .settings-tab.active {
                        border-color: var(--primary);
                        background: white;
                    }
                }
                
                /* Restored Desktop Styles */
                .input-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.2rem;
                }

                @media (max-width: 600px) {
                    .input-grid { grid-template-columns: 1fr; }
                    .profile-sidebar h3, .profile-sidebar span { display: none; }
                    .profile-sidebar { padding: 0.5rem !important; }
                    .profile-sidebar div[style*="width: 80px"] { width: 40px !important; height: 40px !important; margin: 0 !important; }
                    .profile-sidebar div[style*="text-align: center"] { display: flex; align-items: center; gap: 1rem; margin-bottom: 0 !important; }
                }
            `}</style>

            </div>

            {/* Image Zoom Modal - Moved outside the fade-in container */}
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
                        background: 'rgba(0,0,0,0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2147483647,
                        cursor: 'zoom-out',
                        padding: '1rem',
                        boxSizing: 'border-box',
                        animation: 'fadeIn 0.3s ease'
                    }}
                    onClick={() => setZoomedImage(null)}
                >
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
                                borderRadius: '4px',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                animation: 'zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                border: '4px solid white',
                                backgroundColor: 'white'
                            }}
                        />
                    </div>
                    <button
                        className="zoom-close-btn"
                        style={{
                            position: 'fixed',
                            top: '25px',
                            right: '25px',
                            background: 'white',
                            border: 'none',
                            width: '45px',
                            height: '45px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 2147483647,
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                            transition: 'transform 0.2s',
                            color: 'black'
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setZoomedImage(null);
                        }}
                    >
                        <X size={24} />
                    </button>

                    <style>{`
                        .zoom-close-btn:hover {
                            transform: scale(1.1);
                        }
                        @media (max-width: 600px) {
                            .zoom-close-btn {
                                width: 36px;
                                height: 36px;
                                top: 15px;
                                right: 15px;
                            }
                        }
                    `}</style>
                </div>
            )}
        </>
    );
};

export default ProfilePage;
