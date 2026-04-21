import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Users, MapPin, Sparkles, ArrowRight, Check, X, ShieldCheck, Heart, Zap } from 'lucide-react';
import api from '../api/client';

const AnimatedCounter = ({ end, duration = 2000 }: { end: number, duration?: number }) => {
    const [count, setCount] = useState(0);
    const countRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        let startTime: number | null = null;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                const animate = (timestamp: number) => {
                    if (!startTime) startTime = timestamp;
                    const progress = Math.min((timestamp - startTime) / duration, 1);
                    setCount(Math.floor(progress * end));
                    if (progress < 1) requestAnimationFrame(animate);
                };
                requestAnimationFrame(animate);
            }
        }, { threshold: 0.5 });
        if (countRef.current) observer.observe(countRef.current);
        return () => observer.disconnect();
    }, [end, duration]);

    return <span ref={countRef}>{count}</span>;
}

const LandingPage: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({ totalUsers: 0, totalRooms: 0 });
    const heroRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/admin/stats');
                setStats(res.data);
            } catch (e) {
                setStats({ totalUsers: 64, totalRooms: 122 });
            }
        };
        fetchStats();

        const handleMouseMove = (e: MouseEvent) => {
            if (!heroRef.current) return;
            const { clientX, clientY } = e;
            const x = (clientX / window.innerWidth) * 100;
            const y = (clientY / window.innerHeight) * 100;
            heroRef.current.style.setProperty('--mouse-x', `${x}%`);
            heroRef.current.style.setProperty('--mouse-y', `${y}%`);
        };
        
        // Ensure body background is black only for landing page
        const originalBg = document.body.style.background;
        document.body.style.background = '#000';
        
        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            document.body.style.background = originalBg;
        };
    }, []);

    return (
        <div className="goated-wrapper">
            <div className="spotlight-bg" ref={heroRef}></div>

            <div className="landing-container">
                {/* HERO 2.0 - Spotlight Edition */}
                <section className="hero-section premium">
                    <div className="hero-content animate-reveal">
                        <div className="badge-reveal">
                            <span className="premium-badge">
                                <Sparkles size={14} className="sparkle" /> The Future of Co-living is here
                            </span>
                        </div>
                        <h1 className="hero-main-title elite">
                            Your Space.<br />
                            Your Rules.<br />
                            <span className="glow-text">Your Tribe.</span>
                        </h1>
                        <p className="hero-subtitle sleek">
                            We don't just find you a room. We find you a community
                            built on shared values, lifestyle matches, and total safety.
                        </p>
                        <div className="hero-actions gap-xl">
                            <Link to="/rooms" className="glow-btn">
                                Explore Listings <Zap size={18} fill="currentColor" />
                            </Link>
                            {!user && (
                                <Link to="/register" className="minimal-link">
                                    Join Global Network <ArrowRight size={16} />
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="hero-visuals-high">
                        <div className="main-stage">
                            {/* Interactive Floating Element */}
                            <div className="floating-preview glass-card">
                                <div className="card-header">
                                    <div className="live-dot"></div> Active Now
                                </div>
                                <img src="https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=400" alt="Premium Room" />
                                <div className="card-footer">
                                    <div className="label">Match Probability</div>
                                    <div className="value">99.4%</div>
                                </div>
                            </div>
                            <div className="mini-card tech-card">
                                <ShieldCheck size={20} color="var(--primary)" />
                                <span>Verified Profile</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Counter / Stats Section */}
                <section className="stats-ticker-grid">
                    <div className="stat-box">
                        <div className="val"><AnimatedCounter end={stats.totalUsers} />+</div>
                        <div className="lab">Global Users</div>
                    </div>
                    <div className="stat-box">
                        <div className="val"><AnimatedCounter end={stats.totalRooms} />+</div>
                        <div className="lab">Premium Rooms</div>
                    </div>
                    <div className="stat-box">
                        <div className="val"><AnimatedCounter end={120} />K+</div>
                        <div className="lab">Messages Sent</div>
                    </div>
                </section>

                {/* THE "WHY US" - Comparison Power */}
                <section className="comparison-section">
                    <div className="section-header-sleek">
                        <h2>Why RoommateConnect?</h2>
                        <p>We are building the standard for modern urban living.</p>
                    </div>

                    <div className="comparison-table-wrapper glass">
                        <table className="comparison-table">
                            <thead>
                                <tr>
                                    <th>Feature</th>
                                    <th>WhatsApp/FB Groups</th>
                                    <th className="highlight">RoommateConnect</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Lifestyle Matching</td>
                                    <td><X color="#ef4444" size={20} /></td>
                                    <td><Check color="#22c55e" size={20} /> (AI Engine)</td>
                                </tr>
                                <tr>
                                    <td>Privacy (Phone Shield)</td>
                                    <td><X color="#ef4444" size={20} /></td>
                                    <td><Check color="#22c55e" size={20} /></td>
                                </tr>
                                <tr>
                                    <td>Verified Listings</td>
                                    <td><X color="#ef4444" size={20} /></td>
                                    <td><Check color="#22c55e" size={20} /> (Audit Log)</td>
                                </tr>
                                <tr>
                                    <td>Safety Center</td>
                                    <td><X color="#ef4444" size={20} /></td>
                                    <td><Check color="#22c55e" size={20} /> 24/7 Support</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Pillars of Trust */}
                <section className="pillars-section">
                    <div className="pillar-item">
                        <div className="pillar-icon r"><Heart size={32} /></div>
                        <h3>Direct Connection</h3>
                        <p>Skip the endless searching. Connect directly with flatmates and owners for the most transparent housing experience in the city.</p>
                    </div>
                    <div className="pillar-item">
                        <div className="pillar-icon b"><ShieldCheck size={32} /></div>
                        <h3>Verified Profiles</h3>
                        <p>We verify professional credentials and ID proofs. Live with trusted individuals who match your lifestyle and city vibe.</p>
                    </div>
                    <div className="pillar-item">
                        <div className="pillar-icon g"><Zap size={32} /></div>
                        <h3>City-Wide Search</h3>
                        <p>From premium high-rises to affordable shared flats. Find the perfect room across all major neighborhoods in Pune & Mumbai.</p>
                    </div>
                </section>

                {/* HOW IT WORKS */}
                <section className="workflow-section">
                    <div className="section-header-sleek">
                        <span className="text-glow-sm">The Process</span>
                        <h2>Find your Space in 3 Steps</h2>
                    </div>
                    <div className="workflow-grid">
                        <div className="step-card glass">
                            <div className="step-num">01</div>
                            <h4>Share Your Need</h4>
                            <p>Post your room or search request. Be specific about your lifestyle habits and budget preferences.</p>
                        </div>
                        <div className="step-card glass">
                            <div className="step-num">02</div>
                            <h4>AI Vibe Check</h4>
                            <p>Our smart matching engine evaluates social tags and preferences to find your most compatible matches.</p>
                        </div>
                        <div className="step-card glass">
                            <div className="step-num">03</div>
                            <h4>Connect Directly</h4>
                            <p>Use our secure real-time chat to finalize details. Move into your new home with zero friction.</p>
                        </div>
                    </div>
                </section>

                {/* FOUNDER'S STORY - Jay Soni Origin */}
                <section className="origin-section glass">
                    <div className="origin-content">
                        <div className="badge-reveal">
                            <span className="premium-badge">A Message from our Founder</span>
                        </div>
                        <h2>From a Student's Struggle to a <span className="glow-text">City-Wide Solution.</span></h2>
                        <div className="story-vocal">
                            <p>
                                "It started with a simple, painful reality. As a BCA graduate, I remember the grueling days during college of trying to find a room near my campus in a different town. The search was exhausting, the costs were sky-high, and finding a trustworthy partner to split the rent felt impossible."
                            </p>
                            <p>
                                "I realized that thousands of us were struggling in silence. That struggle was my <strong>Golden Opportunity</strong>. I built RoommateConnect to be the platform I wish I had—a place where no student or professional is left to handle the city's weight alone. We don't just find you a room; we find you the partner that makes home feel like home."
                            </p>
                            <div className="founder-sign">
                                <div className="sign-line"></div>
                                <div className="founder-meta">
                                    <span className="name">Jay Soni</span>
                                    <span className="title">Founder & Lead Architect, BCA Graduate</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* City Focus */}
                <section className="student-trust-banner glass">
                    <div className="banner-flex">
                        <div className="text-side">
                            <h3>Pune & Mumbai's #1 Living Network</h3>
                            <p>Trusted by thousands of young professionals and students across the city's most vibrant hubs.</p>
                        </div>
                        <Link to="/register" className="glow-btn">Start Exploring</Link>
                    </div>
                </section>

                <footer className="footer-v2">
                    <div className="footer-content">
                        <div className="brand-logo-small">RoommateConnect</div>
                        <p>The smartest and safest way to find your tribe in the city.</p>
                        <div className="dev-signature">
                            Built & Developed by <span className="name-glow">Jay Soni</span>
                        </div>
                    </div>
                    <div className="copyright-bar">© 2026 RoommateConnect. All Rights Reserved.</div>
                </footer>
            </div>

            <style>{`
                :root {
                    --primary: #4f46e5;
                    --primary-glow: rgba(79, 70, 229, 0.4);
                    --glass: rgba(255, 255, 255, 0.03);
                    --glass-border: rgba(255, 255, 255, 0.1);
                }

                .goated-wrapper {
                    background: #000;
                    color: white;
                    min-height: 100vh;
                    position: relative;
                    overflow: hidden;
                    font-family: 'Outfit', sans-serif;
                }

                .spotlight-bg {
                    position: fixed;
                    top: 0; left: 0; 
                    width: 100%; height: 100%;
                    background: radial-gradient(
                        circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
                        rgba(79, 70, 229, 0.15) 0%,
                        transparent 40%
                    );
                    z-index: 0;
                    pointer-events: none;
                }

                .landing-container {
                    position: relative;
                    z-index: 2;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 1.5rem;
                }

                /* Hero Premium 2.0 */
                .hero-section.premium {
                    display: grid;
                    grid-template-columns: 1.2fr 0.8fr;
                    gap: 6rem;
                    padding: 6rem 0 4rem;
                    align-items: center;
                }

                .hero-main-title.elite {
                    font-size: clamp(3.5rem, 10vw, 6.5rem);
                    font-weight: 900;
                    line-height: 0.9;
                    letter-spacing: -0.06em;
                    margin: 1.5rem 0;
                    color: #fff;
                }

                .glow-text {
                    background: linear-gradient(135deg, #8b5cf6, #4f46e5);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    text-shadow: 0 0 40px rgba(79, 70, 229, 0.5);
                }

                .hero-subtitle.sleek {
                    color: #94a3b8;
                    font-size: 1.3rem;
                    max-width: 500px;
                    line-height: 1.5;
                    margin-bottom: 3.5rem;
                }

                .glow-btn {
                    padding: 1.25rem 3rem;
                    background: linear-gradient(135deg, #4f46e5, #8b5cf6);
                    color: #fff;
                    border-radius: 100px;
                    font-weight: 900;
                    text-decoration: none;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-size: 1.1rem;
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    box-shadow: 0 0 30px rgba(79, 70, 229, 0.4);
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .glow-btn:hover { 
                    transform: translateY(-5px) scale(1.05); 
                    box-shadow: 0 15px 50px rgba(79, 70, 229, 0.6);
                    filter: brightness(1.1);
                }

                .minimal-link { color: #fff; text-decoration: none; font-weight: 700; opacity: 0.7; transition: 0.3s; display: flex; align-items: center; gap: 0.5rem; }
                .minimal-link:hover { opacity: 1; gap: 0.8rem; }

                .premium-badge {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.08);
                    padding: 0.6rem 1.2rem;
                    border-radius: 100px;
                    font-size: 0.85rem;
                    font-weight: 800;
                    color: #a78bfa;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .hero-visuals-high { position: relative; }
                .main-stage {
                    position: relative;
                    perspective: 1000px;
                }

                .floating-preview {
                    background: rgba(255,255,255,0.05);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255,255,255,0.1);
                    padding: 0.75rem;
                    border-radius: 30px;
                    width: 380px;
                    transform: rotateY(-15deg) rotateX(10deg);
                    animation: float-3d 6s infinite ease-in-out;
                    box-shadow: -20px 40px 80px rgba(0,0,0,0.5);
                }
                .floating-preview img { width: 100%; border-radius: 22px; margin: 0.5rem 0; }
                
                .tech-card {
                    position: absolute;
                    top: -20px; right: -20px;
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(15px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    padding: 1rem 1.5rem;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-weight: 900;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                }

                @keyframes float-3d {
                    0%, 100% { transform: rotateY(-15deg) rotateX(10deg) translateY(0); }
                    50% { transform: rotateY(-18deg) rotateX(12deg) translateY(-20px); }
                }

                /* Stats Section */
                .stats-ticker-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 2rem;
                    margin: 4rem 0 8rem;
                    padding: 4rem;
                    background: rgba(255,255,255,0.01);
                    border-radius: 40px;
                    border: 1px solid rgba(255,255,255,0.03);
                }
                .stat-box { text-align: center; }
                .stat-box .val { font-size: 4rem; font-weight: 900; background: linear-gradient(180deg, #fff, #4f46e5); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .stat-box .lab { color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }

                /* Comparison */
                .comparison-section { padding-bottom: 8rem; }
                .section-header-sleek { text-align: center; margin-bottom: 4rem; }
                .section-header-sleek h2 { font-size: 3.5rem; font-weight: 950; margin-bottom: 1rem; }
                .section-header-sleek p { color: #64748b; font-size: 1.2rem; }

                .comparison-table-wrapper {
                    background: rgba(255,255,255,0.03);
                    border-radius: 30px;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .comparison-table { width: 100%; border-collapse: collapse; text-align: left; min-width: 600px; }
                .comparison-table th, .comparison-table td { padding: 2rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 1.1rem; }
                .comparison-table th { background: rgba(255,255,255,0.01); font-weight: 900; color: #94a3b8; }
                .comparison-table .highlight { color: #a78bfa; font-size: 1.3rem; }
                .comparison-table tr:hover { background: rgba(255,255,255,0.02); }

                /* Pillars */
                .pillars-section { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3rem; padding-bottom: 8rem; }
                .pillar-item { text-align: left; }
                .pillar-icon { width: 70px; height: 70px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 2rem; }
                .pillar-icon.r { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
                .pillar-icon.b { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
                .pillar-icon.g { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
                .pillar-item h3 { font-size: 1.6rem; font-weight: 900; margin-bottom: 1rem; }
                .pillar-item p { color: #64748b; line-height: 1.6; }

                /* Responsive */
                /* Workflow Section */
                .workflow-section { padding-bottom: 8rem; }
                .workflow-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; margin-top: 3rem; }
                .step-card { 
                    padding: 3rem 2rem; border-radius: 30px; background: rgba(255,255,255,0.02); 
                    border: 1px solid rgba(255,255,255,0.05); transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
                    position: relative; overflow: hidden;
                }
                .step-card:hover { background: rgba(255,255,255,0.04); transform: translateY(-10px); }
                .step-num { 
                    font-size: 4rem; font-weight: 900; opacity: 0.1; position: absolute; top: -10px; right: 10px;
                    background: linear-gradient(180deg, #fff, transparent); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                }
                .step-card h4 { font-size: 1.5rem; font-weight: 800; margin-bottom: 1rem; color: #fff; }
                .step-card p { color: #64748b; line-height: 1.6; }

                /* Trust Banner */
                .student-trust-banner {
                    padding: 4rem; border-radius: 40px; margin-bottom: 8rem;
                    background: linear-gradient(90deg, rgba(79, 70, 229, 0.1), rgba(139, 92, 246, 0.1));
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .banner-flex { display: flex; justify-content: space-between; align-items: center; gap: 2rem; }
                .banner-flex h3 { font-size: 2.5rem; font-weight: 900; margin-bottom: 0.5rem; }
                .banner-flex p { color: #94a3b8; font-size: 1.2rem; }

                /* Origin Section */
                .origin-section {
                    padding: 6rem; border-radius: 50px; margin-bottom: 8rem;
                    background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03);
                    text-align: left;
                }
                .origin-content h2 { font-size: 3.5rem; font-weight: 950; margin: 2rem 0; line-height: 1; }
                .story-vocal p { 
                    font-size: 1.4rem; color: #94a3b8; line-height: 1.8; margin-bottom: 2rem; 
                    font-style: italic; max-width: 800px;
                }
                .founder-sign { display: flex; align-items: center; gap: 2rem; margin-top: 4rem; }
                .sign-line { width: 60px; height: 2px; background: var(--primary); }
                .founder-meta { display: flex; flex-direction: column; }
                .founder-meta .name { font-size: 1.5rem; font-weight: 900; color: #fff; }
                .founder-meta .title { font-size: 0.9rem; color: var(--primary); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }

                .dev-signature { margin-top: 2.5rem; font-weight: 800; font-size: 0.95rem; opacity: 0.8; }
                .name-glow { color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.4); }

                .text-glow-sm { font-size: 0.9rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; color: #a78bfa; margin-bottom: 1rem; display: block; }

                @media (max-width: 968px) {
                    .hero-section.premium { grid-template-columns: 1fr; text-align: center; padding: 4rem 1rem; gap: 3rem; }
                    .hero-main-title.elite { font-size: clamp(2.5rem, 8vw, 4rem); }
                    .hero-subtitle.sleek { margin: 1.5rem auto 3rem; font-size: 1.1rem; }
                    .hero-visuals-high { display: none; }
                    .stats-ticker-grid { grid-template-columns: 1fr; gap: 3rem; padding: 2rem; margin: 2rem 0 4rem; }
                    .stat-box .val { font-size: 3rem; }
                    .section-header-sleek h2 { font-size: 2.5rem; }
                    .comparison-section { padding-bottom: 4rem; }
                    .pillars-section { grid-template-columns: 1fr; text-align: center; padding-bottom: 4rem; gap: 2rem; }
                    .workflow-grid { grid-template-columns: 1fr; gap: 1.5rem; }
                    .step-card { padding: 2rem 1.5rem; }
                    .origin-section { padding: 2rem; border-radius: 30px; margin-bottom: 4rem; }
                    .origin-content h2 { font-size: 2.2rem; }
                    .story-vocal p { font-size: 1.1rem; }
                    .founder-sign { flex-direction: column; text-align: center; gap: 1rem; margin-top: 2rem; }
                    .sign-line { display: none; }
                    .student-trust-banner { padding: 2rem; margin-bottom: 4rem; border-radius: 30px; }
                    .banner-flex { flex-direction: column; text-align: center; gap: 1.5rem; }
                    .banner-flex h3 { font-size: 1.8rem; }
                    .pillar-icon { margin: 0 auto 1.5rem; }
                    .hero-actions { flex-direction: column; width: 100%; gap: 1rem; }
                    .glow-btn { width: 100%; justify-content: center; }
                    .comparison-table th, .comparison-table td { font-size: 0.9rem; padding: 1rem; }
                }

                .footer-v2 { border-top: 1px solid rgba(255,255,255,0.05); padding: 4rem 0; text-align: center; }
                .brand-logo-small { font-size: 1.5rem; font-weight: 950; margin-bottom: 1rem; color: #a78bfa; }
                .copyright-bar { margin-top: 3rem; opacity: 0.3; font-size: 0.8rem; font-weight: 700; }

                .animate-reveal { animation: reveal 1s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes reveal {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }

            `}</style>
        </div>
    );
};

export default LandingPage;
