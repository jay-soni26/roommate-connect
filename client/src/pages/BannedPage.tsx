import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Shield, MessageSquare, AlertTriangle, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const BannedPage: React.FC = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleContactAdmin = async () => {
        try {
            // Find super admin to start chat
            const { data } = await api.get('/users/super-admin');
            navigate('/chat', { state: { partnerId: data.id } });
        } catch (e) {
            toast.error('Admin routing in progress. Please try again or re-login.');
        }
    };

    return (
        <div className="container animate-fade-in" style={{ 
            minHeight: '80vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '2rem'
        }}>
            <div className="glass-panel" style={{ 
                maxWidth: '600px', 
                padding: '3rem', 
                textAlign: 'center',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                boxShadow: '0 20px 50px rgba(239, 68, 68, 0.1)'
            }}>
                <div style={{ 
                    width: '80px', 
                    height: '80px', 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    color: '#ef4444', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    margin: '0 auto 2rem' 
                }}>
                    <AlertTriangle size={40} />
                </div>

                <h1 style={{ 
                    fontSize: '2.5rem', 
                    fontWeight: 900, 
                    color: '#ef4444', 
                    marginBottom: '1rem',
                    letterSpacing: '-0.02em'
                }}>Account Restricted</h1>

                <p style={{ 
                    fontSize: '1.1rem', 
                    lineHeight: '1.7', 
                    color: 'var(--text-muted)', 
                    marginBottom: '2.5rem' 
                }}>
                    Suspicious activity or illegal content violations have been detected on this account. 
                    To ensure the safety of our community, your access has been temporarily suspended.
                </p>

                <div style={{ 
                    background: '#f8fafc', 
                    padding: '1.5rem', 
                    borderRadius: '16px', 
                    marginBottom: '2.5rem',
                    textAlign: 'left',
                    border: '1px solid #e2e8f0'
                }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>System Status</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontWeight: 700 }}>
                        <Shield size={18} /> Permanent Blacklist sync: Active
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button 
                        onClick={handleContactAdmin}
                        className="btn-primary" 
                        style={{ flex: 2, padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                        <MessageSquare size={20} /> Appeal Decision
                    </button>
                    <button 
                        onClick={() => { logout(); navigate('/login'); }}
                        style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                        <LogOut size={20} /> Logout
                    </button>
                </div>

                <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                    Reference ID: RC-BAN-{Math.floor(Math.random()*10000)}
                </p>
            </div>
        </div>
    );
};

export default BannedPage;
