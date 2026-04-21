import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login, setBanned } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const response = await api.post('/auth/login', { email, password });
            login(response.data.token, response.data.user);
            navigate('/');
        } catch (err: any) {
            console.error('Login error:', err);
            const serverError = err.response?.data?.error;
            const serverDetails = err.response?.data?.details;
            const networkError = err.message;

            if (err.response?.status === 403 && err.response?.data?.isBanned) {
                setBanned(true);
                navigate('/banned');
                return;
            }

            if (serverError) {
                setError(serverDetails ? `${serverError}: ${serverDetails}` : serverError);
            } else {
                setError(networkError || 'Login failed');
            }
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'clamp(1rem, 5vw, 4rem)', minHeight: 'calc(100vh - 150px)', alignItems: 'center' }} className="animate-fade-in">
            <div className="glass-panel" style={{ padding: 'clamp(1.5rem, 5vw, 3rem)', width: '100%', maxWidth: '450px', boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <h2 style={{ color: 'var(--primary)', fontSize: 'clamp(1.8rem, 5vw, 2.2rem)', fontWeight: 800, margin: '0 0 0.5rem' }}>Welcome Back</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>The easiest way to find your next home</p>
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
                    <div style={{ marginBottom: '1.2rem' }}>
                        <label className="auth-label">Email Address</label>
                        <input
                            type="email"
                            placeholder="e.g. alex@example.com"
                            className="input-field"
                            style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                            <label className="auth-label" style={{ marginBottom: 0 }}>Password</label>
                            <a href="#" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Forgot?</a>
                        </div>
                        <input
                            type="password"
                            placeholder="••••••••"
                            className="input-field"
                            style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', borderRadius: '14px', fontWeight: 700 }}>
                        Sign In
                    </button>
                </form>

                <div style={{ position: 'relative', margin: '2rem 0', textAlign: 'center' }}>
                    <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />
                    <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', padding: '0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>or continue with</span>
                </div>

                <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                    New to the community? <a href="/register" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>Create Account</a>
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
                .input-field:focus {
                    background: white !important;
                    border-color: var(--primary) !important;
                    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1) !important;
                }
            `}</style>
        </div>
    );
};

export default Login;
