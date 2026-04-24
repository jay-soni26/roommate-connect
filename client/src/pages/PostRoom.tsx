import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { API_BASE } from '../api/client';
import { X, Image as ImageIcon } from 'lucide-react';
import { getStates, getCitiesByState } from '../data/indianStatesAndCities';


const PostRoom: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);


    const [formData, setFormData] = useState({
        postingType: 'OFFERING',
        title: '',
        description: '',
        location: '', // Area/Neighborhood
        state: '',
        city: '',
        address: '',
        rentPerPerson: '',
        capacity: '',
        currentOccupancy: '',
        propertyType: '',
        furnishing: '',
        amenities: '',
        genderPreference: 'Any',
        lookingFor: '',
        images: '',
    });
    const [availableStates, setAvailableStates] = useState<string[]>([]);
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    // Image Upload State
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    // const API_BASE removed (using imported)

    useEffect(() => {
        setAvailableStates(getStates());
    }, []);

    // Auto-fill from User Profile when switching to SEEKING
    // Auto-fill from User Profile when switching to SEEKING
    useEffect(() => {
        const fetchProfileAndAutofill = async () => {
            if (!isEditMode && formData.postingType === 'SEEKING') {
                try {
                    // Fetch full profile data as AuthContext user might be partial
                    const { data: userProfile } = await api.get('/users/profile');

                    if (userProfile) {
                        setFormData(prev => ({
                            ...prev,
                            state: userProfile.state || prev.state,
                            city: userProfile.city || prev.city,
                            // Autofill max budget as rentPerPerson if available
                            rentPerPerson: userProfile.budgetMax ? String(userProfile.budgetMax) : prev.rentPerPerson,
                            // Map preferredRoomType to propertyType
                            propertyType: userProfile.preferredRoomType || prev.propertyType,
                            // Default gender preference to user's own gender
                            genderPreference: userProfile.gender || 'Any',
                        }));

                        if (userProfile.state) {
                            setAvailableCities(getCitiesByState(userProfile.state));
                        }
                    }
                } catch (error) {
                    console.error("Failed to fetch user profile for auto-fill", error);
                }
            }
        };

        fetchProfileAndAutofill();
    }, [formData.postingType, isEditMode]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const validFiles = files.slice(0, 5 - previews.length); // Max 5 images total

            setSelectedFiles([...selectedFiles, ...validFiles]);

            const newPreviews = validFiles.map(file => URL.createObjectURL(file));
            setPreviews([...previews, ...newPreviews]);
        }
    };

    const removeImage = (index: number) => {
        const previewToRemove = previews[index];

        // If it's a new file (blob URL), remove from selectedFiles
        if (previewToRemove.startsWith('blob:')) {
            const blobIndex = previews.filter((p, i) => i < index && p.startsWith('blob:')).length;
            const newFiles = [...selectedFiles];
            newFiles.splice(blobIndex, 1);
            setSelectedFiles(newFiles);
            URL.revokeObjectURL(previewToRemove);
        }

        const newPreviews = [...previews];
        newPreviews.splice(index, 1);
        setPreviews(newPreviews);
    };

    useEffect(() => {
        if (isEditMode) {
            const fetchRoom = async () => {
                try {
                    const { data } = await api.get(`/rooms/${id}`);
                    setFormData({
                        postingType: data.postingType || 'OFFERING',
                        title: data.title,
                        description: data.description,
                        location: data.location,
                        state: data.state || '',
                        city: data.city || '',
                        address: data.address || '',
                        rentPerPerson: String(data.rentPerPerson),
                        capacity: String(data.capacity),
                        currentOccupancy: String(data.currentOccupancy),
                        propertyType: data.propertyType || '',
                        furnishing: data.furnishing || '',
                        amenities: data.amenities || '',
                        genderPreference: data.genderPreference || 'Any',
                        lookingFor: data.lookingFor || '',
                        images: data.images || '',
                    });

                    if (data.state) {
                        setAvailableCities(getCitiesByState(data.state));
                    }

                    // Parse existing images for previews
                    if (data.images) {
                        try {
                            const existing = JSON.parse(data.images);
                            if (Array.isArray(existing)) {
                                setPreviews(existing.map(path => path.startsWith('http') ? path : `${API_BASE}${path}`));
                            }
                        } catch (e) {
                            console.error('Failed to parse existing images', e);
                        }
                    }
                } catch (err) {
                    setError('Failed to fetch room details');
                }
            };
            fetchRoom();
        }
    }, [id, isEditMode]);

    const handleStateChange = (stateName: string) => {
        setFormData(prev => ({ ...prev, state: stateName, city: '' }));
        setAvailableCities(getCitiesByState(stateName));
        validateField('state', stateName);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'state') {
            handleStateChange(value);
        } else {
            setFormData({ ...formData, [name]: value });
            validateField(name, value);
        }
    };

    const validateField = (name: string, value: string) => {
        let error = '';
        if (name === 'rentPerPerson') {
            if (Number(value) < 0) error = 'Rent/Budget cannot be negative';
            else if (Number(value) === 0) error = 'Rent/Budget must be greater than zero';
        } else if (name === 'capacity') {
            if (Number(value) <= 0) error = 'Capacity must be at least 1 person';
        } else if (name === 'currentOccupancy') {
            if (Number(value) < 0) error = 'Occupancy cannot be negative';
            else if (Number(value) > Number(formData.capacity)) error = 'Occupancy cannot exceed capacity';
        } else if (name === 'title') {
            if (value.length > 0 && value.length < 5) error = 'Title is too short (min 5 chars)';
        } else if (name === 'description') {
            if (value.length > 0 && value.length < 10) error = 'Description is too short (min 10 chars)';
        } else if (name === 'address') {
            if (value.length > 0 && value.length < 5) error = 'Address is too short';
        }

        setFieldErrors(prev => ({ ...prev, [name]: error }));
    };

    const validateAll = () => {
        const errors: Record<string, string> = {};

        if (!formData.title || formData.title.length < 5) errors.title = 'Title must be at least 5 characters';
        if (!formData.description || formData.description.length < 10) errors.description = 'Description must be at least 10 characters';
        if (!formData.state) errors.state = 'State is required';
        if (!formData.city) errors.city = 'City is required';
        if (!formData.location) errors.location = 'Area/Neighborhood is required';
        if (!formData.address) errors.address = 'Full address is required';

        const rent = Number(formData.rentPerPerson);
        if (isNaN(rent) || rent <= 0) errors.rentPerPerson = 'Rent/Budget must be a positive number';

        const cap = Number(formData.capacity);
        if (isNaN(cap) || cap <= 0) errors.capacity = 'Capacity must be at least 1';

        if (formData.postingType === 'OFFERING') {
            const occ = Number(formData.currentOccupancy);
            if (isNaN(occ) || occ < 0) errors.currentOccupancy = 'Occupancy cannot be negative';
            else if (occ > cap) errors.currentOccupancy = 'Occupancy cannot exceed capacity';
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validateAll()) {
            setError('Please correct the highlighted errors before submitting.');
            return;
        }

        setUploading(true);

        try {
            let uploadedUrls: string[] = [];

            // 1. Upload new files if any
            if (selectedFiles.length > 0) {
                const uploadFormData = new FormData();
                selectedFiles.forEach(file => uploadFormData.append('images', file));

                try {
                    const uploadRes = await api.post('/upload/room-images', uploadFormData);
                    uploadedUrls = uploadRes.data.urls;
                } catch (err: any) {
                    throw new Error(err.response?.data?.error || 'Failed to upload images.');
                }
            }

            // 2. Combine with remaining existing images
            const finalImages = [
                ...previews
                    .filter(p => !p.startsWith('blob:'))
                    .map(p => p.replace(API_BASE, '')),
                ...uploadedUrls
            ];

            const payload = {
                ...formData,
                rentPerPerson: Number(formData.rentPerPerson),
                capacity: Number(formData.capacity),
                currentOccupancy: Number(formData.currentOccupancy || 0),
                images: JSON.stringify(finalImages),
            };

            if (isEditMode) {
                await api.put(`/rooms/${id}`, payload);
            } else {
                await api.post('/rooms', payload);
            }
            navigate(isEditMode ? '/profile' : '/rooms');
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to save room.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{ padding: 'clamp(1rem, 5vw, 3rem)', display: 'flex', justifyContent: 'center' }} className="animate-fade-in">
            <div className="glass-panel" style={{ padding: 'clamp(1.5rem, 5vw, 2.5rem)', width: '100%', maxWidth: '800px' }}>
                <h2 style={{ marginBottom: '2rem', color: 'var(--primary)', fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', fontWeight: 800 }}>{isEditMode ? 'Edit Listing' : 'Create New Listing'}</h2>

                {error && <div style={{ color: '#ef4444', marginBottom: '1.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 500 }}>
                    ⚠️ {error}
                </div>}

                <form onSubmit={handleSubmit}>
                    {/* Posting Type Selection */}
                    <div style={{ marginBottom: '2.5rem' }}>
                        <label className="form-label">What would you like to do?</label>
                        <div className="intent-selector">
                            <div
                                onClick={() => setFormData({ ...formData, postingType: 'SEEKING' })}
                                className={`intent-card ${formData.postingType === 'SEEKING' ? 'active' : ''}`}
                            >
                                <div className="icon">🔍</div>
                                <div className="text">
                                    <div className="title">I Need a Room</div>
                                    <div className="subtitle">Looking for accommodation</div>
                                </div>
                            </div>
                            <div
                                onClick={() => setFormData({ ...formData, postingType: 'OFFERING' })}
                                className={`intent-card ${formData.postingType === 'OFFERING' ? 'active' : ''}`}
                            >
                                <div className="icon">🏠</div>
                                <div className="text">
                                    <div className="title">Room Available</div>
                                    <div className="subtitle">I have space to offer</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                        {/* Title */}
                        <div>
                            <label className="form-label">Post Title</label>
                            <input
                                name="title"
                                placeholder={formData.postingType === 'SEEKING' ? 'e.g. Student looking for 1BHK in Bandra' : 'e.g. Spacious 2BHK available in Bandra'}
                                className="input-field"
                                style={{ borderColor: fieldErrors.title ? '#ef4444' : undefined }}
                                value={formData.title}
                                onChange={handleChange}
                                required
                            />
                            {fieldErrors.title && <div className="error-msg">{fieldErrors.title}</div>}
                        </div>

                        {/* Description */}
                        <div>
                            <label className="form-label">Description Details</label>
                            <textarea
                                name="description"
                                placeholder={formData.postingType === 'SEEKING' ? 'Describe your requirements, budget, lifestyle...' : 'Describe the property, amenities, location...'}
                                className="input-field"
                                style={{ minHeight: '120px', borderColor: fieldErrors.description ? '#ef4444' : undefined, resize: 'vertical' }}
                                value={formData.description}
                                onChange={handleChange}
                                required
                            />
                            {fieldErrors.description && <div className="error-msg">{fieldErrors.description}</div>}
                        </div>

                        {/* Location Selectors */}
                        <div className="specs-grid">
                            <div>
                                <label className="form-label">State</label>
                                <select
                                    name="state"
                                    className="input-field"
                                    style={{ borderColor: fieldErrors.state ? '#ef4444' : undefined }}
                                    value={formData.state}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select State</option>
                                    {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                {fieldErrors.state && <div className="error-msg">{fieldErrors.state}</div>}
                            </div>
                            <div>
                                <label className="form-label">City</label>
                                <select
                                    name="city"
                                    className="input-field"
                                    style={{ borderColor: fieldErrors.city ? '#ef4444' : undefined }}
                                    value={formData.city}
                                    onChange={handleChange}
                                    disabled={!formData.state}
                                    required
                                >
                                    <option value="">Select City</option>
                                    {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {fieldErrors.city && <div className="error-msg">{fieldErrors.city}</div>}
                            </div>
                        </div>

                        <div className="specs-grid">
                            <div>
                                <label className="form-label">Area / Neighborhood</label>
                                <input
                                    name="location"
                                    placeholder="e.g. Bandra West"
                                    className="input-field"
                                    style={{ borderColor: fieldErrors.location ? '#ef4444' : undefined }}
                                    value={formData.location}
                                    onChange={handleChange}
                                    required
                                />
                                {fieldErrors.location && <div className="error-msg">{fieldErrors.location}</div>}
                            </div>
                            <div>
                                <label className="form-label">{formData.postingType === 'SEEKING' ? 'Max Budget (₹)' : 'Rent per Person (₹)'}</label>
                                <input
                                    name="rentPerPerson"
                                    type="number"
                                    placeholder="e.g. 15000"
                                    className="input-field"
                                    style={{ borderColor: fieldErrors.rentPerPerson ? '#ef4444' : undefined }}
                                    value={formData.rentPerPerson}
                                    onChange={handleChange}
                                    required
                                />
                                {fieldErrors.rentPerPerson && <div className="error-msg">{fieldErrors.rentPerPerson}</div>}
                            </div>
                        </div>

                        <div>
                            <label className="form-label">Complete Address</label>
                            <input
                                name="address"
                                placeholder="Flat No, Building Name, Landmark..."
                                className="input-field"
                                style={{ borderColor: fieldErrors.address ? '#ef4444' : undefined }}
                                value={formData.address}
                                onChange={handleChange}
                                required
                            />
                            {fieldErrors.address && <div className="error-msg">{fieldErrors.address}</div>}
                        </div>

                        {/* Property Specs Grid */}
                        <div className="specs-grid">
                            <div>
                                <label className="form-label">Room/Property Type</label>
                                <select
                                    name="propertyType"
                                    className="input-field"
                                    value={formData.propertyType}
                                    onChange={handleChange}
                                >
                                    <option value="">Any Type</option>
                                    <option value="Single Room">Single Room</option>
                                    <option value="1RK">1RK</option>
                                    <option value="1BHK">1BHK</option>
                                    <option value="2BHK">2BHK</option>
                                    <option value="3BHK">3BHK</option>
                                    <option value="4BHK+">4BHK+</option>
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Furnishing Status</label>
                                <select
                                    name="furnishing"
                                    className="input-field"
                                    value={formData.furnishing}
                                    onChange={handleChange}
                                >
                                    <option value="">Any Status</option>
                                    <option value="FURNISHED">Fully Furnished</option>
                                    <option value="SEMI_FURNISHED">Semi Furnished</option>
                                    <option value="UNFURNISHED">Unfurnished</option>
                                </select>
                            </div>
                        </div>

                        {/* Conditional Fields based on Posting Type */}
                        {formData.postingType === 'OFFERING' ? (
                            <>
                                <div className="specs-grid">
                                    <div>
                                        <label className="form-label">Total Room Capacity</label>
                                        <input
                                            name="capacity"
                                            type="number"
                                            placeholder="e.g. 2"
                                            className="input-field"
                                            style={{ borderColor: fieldErrors.capacity ? '#ef4444' : undefined }}
                                            value={formData.capacity}
                                            onChange={handleChange}
                                            required
                                        />
                                        {fieldErrors.capacity && <div className="error-msg">{fieldErrors.capacity}</div>}
                                    </div>
                                    <div>
                                        <label className="form-label">Currently Occupied</label>
                                        <input
                                            name="currentOccupancy"
                                            type="number"
                                            placeholder="e.g. 1"
                                            className="input-field"
                                            style={{ borderColor: fieldErrors.currentOccupancy ? '#ef4444' : undefined }}
                                            value={formData.currentOccupancy}
                                            onChange={handleChange}
                                        />
                                        {fieldErrors.currentOccupancy && <div className="error-msg">{fieldErrors.currentOccupancy}</div>}
                                    </div>
                                </div>

                                <div>
                                    <label className="form-label">Ideal Occupant</label>
                                    <select
                                        name="lookingFor"
                                        className="input-field"
                                        value={formData.lookingFor}
                                        onChange={handleChange}
                                    >
                                        <option value="">No Preference</option>
                                        <option value="BACHELOR">Bachelor</option>
                                        <option value="FAMILY">Family</option>
                                        <option value="STUDENT">Student</option>
                                        <option value="PROFESSIONAL">Working Professional</option>
                                        <option value="ANY">Anyone</option>
                                    </select>
                                </div>
                            </>
                        ) : (
                            <div>
                                <label className="form-label">Group Size</label>
                                <input
                                    name="capacity"
                                    type="number"
                                    placeholder="Number of people (e.g. 1 for solo)"
                                    className="input-field"
                                    style={{ borderColor: fieldErrors.capacity ? '#ef4444' : undefined }}
                                    value={formData.capacity}
                                    onChange={handleChange}
                                    required
                                />
                                {fieldErrors.capacity && <div className="error-msg">{fieldErrors.capacity}</div>}
                            </div>
                        )}

                        {/* Gender Preference */}
                        <div>
                            <label className="form-label">Gender Preference</label>
                            <select
                                name="genderPreference"
                                className="input-field"
                                value={formData.genderPreference}
                                onChange={handleChange}
                            >
                                <option value="Any">Any Gender</option>
                                <option value="Male">Male Only</option>
                                <option value="Female">Female Only</option>
                            </select>
                        </div>

                        {/* Image Upload Section - Only for OFFERING */}
                        {formData.postingType === 'OFFERING' && (
                            <div>
                                <label className="form-label">Property Photos (Up to 5)</label>
                                <div className="image-uploader">
                                    {previews.map((preview, index) => (
                                        <div key={index} className="image-slot">
                                            <img src={preview} alt="preview" />
                                            <button type="button" onClick={() => removeImage(index)} className="remove-btn">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}

                                    {previews.length < 5 && (
                                        <label className="upload-btn">
                                            <ImageIcon size={28} />
                                            <span>Add Photo</span>
                                            <input type="file" multiple accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                                        </label>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.8rem' }}>Recommended: High-quality JPEG or PNG (Max 5MB per file)</p>
                            </div>
                        )}
                    </div>

                    <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '3rem', padding: '1.2rem', fontSize: '1.1rem', borderRadius: '14px' }} disabled={uploading}>
                        {uploading ? 'Processing...' : (isEditMode ? '✨ Save Changes' : (formData.postingType === 'SEEKING' ? '🔍 Post My Request' : '🏠 List My Room'))}
                    </button>
                </form>
            </div>

            <style>{`
                .form-label {
                    display: block;
                    margin-bottom: 0.6rem;
                    font-weight: 700;
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .error-msg {
                    color: #ef4444;
                    font-size: 0.8rem;
                    margin-top: 0.4rem;
                    font-weight: 600;
                }
                .intent-selector {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.2rem;
                }
                .intent-card {
                    padding: 1.5rem;
                    border-radius: 16px;
                    border: 2px solid var(--glass-border);
                    background: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .intent-card:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                .intent-card.active { border-color: var(--primary); background: rgba(79, 70, 229, 0.04); box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1); }
                .intent-card .icon { font-size: 2.2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1)); }
                .intent-card .title { font-weight: 800; font-size: 1.1rem; color: var(--text-main); margin-bottom: 0.2rem; }
                .intent-card .subtitle { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
                
                .specs-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.2rem;
                }

                .image-uploader {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(100px, 120px));
                    gap: 1rem;
                    margin-top: 0.5rem;
                }
                .image-slot {
                    position: relative;
                    aspect-ratio: 1;
                    border-radius: 12px;
                    overflow: hidden;
                    border: 1px solid var(--glass-border);
                }
                .image-slot img { width: 100%; height: 100%; object-fit: cover; }
                .remove-btn {
                    position: absolute;
                    top: 6px;
                    right: 6px;
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 24px;
                    height: 24px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    transition: transform 0.2s;
                }
                .remove-btn:hover { transform: scale(1.1); }
                
                .upload-btn {
                    aspect-ratio: 1;
                    border: 2px dashed var(--glass-border);
                    border-radius: 12px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: var(--text-muted);
                    transition: all 0.2s;
                    background: #f9fafb;
                    font-weight: 600;
                    font-size: 0.75rem;
                }
                .upload-btn:hover { border-color: var(--primary); color: var(--primary); background: rgba(79, 70, 229, 0.02); }

                @media (max-width: 650px) {
                    .intent-selector, .specs-grid { grid-template-columns: 1fr; }
                    .intent-card { padding: 1.2rem; }
                    .intent-card .icon { font-size: 1.8rem; }
                }
            `}</style>
        </div>
    );
};

export default PostRoom;
