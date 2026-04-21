import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const Register: React.FC = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phoneNumber: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const { login } = useAuth();
    const navigate = useNavigate();

    const validateField = (name: string, value: string) => {
        let errorMsg = '';
        if (name === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (value && !emailRegex.test(value)) errorMsg = 'Invalid email format';
        } else if (name === 'password') {
            if (value && value.length < 6) errorMsg = 'Password must be at least 6 characters';
        } else if (name === 'confirmPassword') {
            if (value && value !== formData.password) errorMsg = 'Passwords do not match';
        } else if (name === 'phoneNumber') {
            const phoneRegex = /^[0-9+\s-]{10,15}$/;
            if (value && !phoneRegex.test(value)) errorMsg = 'Invalid phone number format';
        }
        setFieldErrors(prev => ({ ...prev, [name]: errorMsg }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        validateField(name, value);
    };

    const validateAll = () => {
        const errors: Record<string, string> = {};
        if (!formData.name) errors.name = 'Full name is required';
        if (!formData.email) errors.email = 'Email is required';
        if (!formData.phoneNumber) errors.phoneNumber = 'Phone number is required';
        if (!formData.password || formData.password.length < 6) errors.password = 'Password must be at least 6 chars';
        if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'Passwords do not match';

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validateAll()) {
            setError('Please correct the highlighted errors before submitting');
            return;
        }

        try {
            const response = await api.post('/auth/register', formData);
            login(response.data.token, response.data.user);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Registration failed');
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'clamp(1rem, 5vw, 4rem)', minHeight: 'calc(100vh - 150px)', alignItems: 'center' }} className="animate-fade-in">
            <div className="glass-panel" style={{ padding: 'clamp(1.5rem, 5vw, 3rem)', width: '100%', maxWidth: '500px', boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <h2 style={{ color: 'var(--primary)', fontSize: 'clamp(1.8rem, 5vw, 2.2rem)', fontWeight: 800, margin: '0 0 0.5rem' }}>Join the Community</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Find your perfect roommate in minutes</p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.05)',
                        color: '#ef4444',
                        padding: '1rem',
                        borderRadius: '12px',
                        marginBottom: '1.5rem',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        border: '1px solid rgba(239, 68, 68, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem'
                    }}>
                        <span>⚠️</span> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gap: '1.2rem' }}>
                        <div>
                            <label className="auth-label">Full Name</label>
                            <input
                                name="name"
                                type="text"
                                placeholder="e.g. John Doe"
                                className="input-field"
                                style={{ borderColor: fieldErrors.name ? '#ef4444' : '#e2e8f0', borderRadius: '12px' }}
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                            {fieldErrors.name && <div className="field-error">💡 {fieldErrors.name}</div>}
                        </div>

                        <div>
                            <label className="auth-label">Email Address</label>
                            <input
                                name="email"
                                type="email"
                                placeholder="e.g. john@example.com"
                                className="input-field"
                                style={{ borderColor: fieldErrors.email ? '#ef4444' : '#e2e8f0', borderRadius: '12px' }}
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                            {fieldErrors.email && <div className="field-error">💡 {fieldErrors.email}</div>}
                        </div>

                        <div>
                            <label className="auth-label">Phone Number</label>
                            <input
                                name="phoneNumber"
                                type="tel"
                                placeholder="e.g. +91 98765 43210"
                                className="input-field"
                                style={{ borderColor: fieldErrors.phoneNumber ? '#ef4444' : '#e2e8f0', borderRadius: '12px' }}
                                value={formData.phoneNumber}
                                onChange={handleChange}
                                required
                            />
                            {fieldErrors.phoneNumber && <div className="field-error">💡 {fieldErrors.phoneNumber}</div>}
                        </div>

                        <div className="auth-grid-2">
                            <div>
                                <label className="auth-label">Password</label>
                                <input
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
                                    className="input-field"
                                    style={{ borderColor: fieldErrors.password ? '#ef4444' : '#e2e8f0', borderRadius: '12px' }}
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                />
                                {fieldErrors.password && <div className="field-error">💡 {fieldErrors.password}</div>}
                            </div>
                            <div>
                                <label className="auth-label">Confirm</label>
                                <input
                                    name="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    className="input-field"
                                    style={{ borderColor: fieldErrors.confirmPassword ? '#ef4444' : '#e2e8f0', borderRadius: '12px' }}
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                />
                                {fieldErrors.confirmPassword && <div className="field-error">💡 {fieldErrors.confirmPassword}</div>}
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '2.5rem', padding: '1rem', fontSize: '1.1rem', borderRadius: '14px', fontWeight: 700 }}>
                        Create My Account
                    </button>
                </form>

                <div style={{ position: 'relative', margin: '2rem 0', textAlign: 'center' }}>
                    <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />
                    <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', padding: '0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>or</span>
                </div>

                <p style={{ textAlign: 'center', fontSize: '0.95rem', color: 'var(--text-muted)', margin: 0 }}>
                    Already part of the family? <a href="/login" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>Sign In</a>
                </p>
            </div>

            <style>{`
                .auth-label {
                    display: block;
                    margin-bottom: 0.6rem;
                    font-weight: 700;
                    font-size: 0.85rem;
                    color: var(--text-main);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .field-error {
                    color: #ef4444;
                    font-size: 0.75rem;
                    margin-top: 0.4rem;
                    font-weight: 500;
                }
                .auth-grid-2 {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }
                .input-field:focus {
                    background: white !important;
                    border-color: var(--primary) !important;
                    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1) !important;
                }
                @media (max-width: 480px) {
                    .auth-grid-2 { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default Register;
