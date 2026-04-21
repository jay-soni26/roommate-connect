import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import PostRoom from './pages/PostRoom';
import RoomList from './pages/RoomList';
import RoommateList from './pages/RoommateList';
import FindRoommates from './pages/FindRoommates';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';
import BannedPage from './pages/BannedPage';
import LandingPage from './pages/LandingPage';
import FavoritesPage from './pages/FavoritesPage';


import { useAuth } from './context/AuthContext';
import { MessageSquare, ShieldAlert } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from './api/client';
import { Toaster, toast } from 'react-hot-toast';


const App: React.FC = () => {
  const { user, isBanned } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleContactSupport = async () => {
    try {
      const { data } = await api.get('/users/super-admin');
      const chatRes = await api.post('/chats/start', { partnerId: data.id });
      navigate('/chat', { state: { activeChatId: chatRes.data.id } });
    } catch (e: any) {
      console.error(e);
      toast.error('Error connecting to support: ' + (e.response?.data?.error || e.message));
    }
  };

  const isLandingPage = location.pathname === '/';

  return (
    <div className="app">
      <Toaster position="top-right" />
      {isBanned && user && (
        <div className="admin-banner animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <ShieldAlert size={32} />
            <div style={{ textAlign: 'left' }}>
              <h3>Hi {user.name.split(' ')[0]}, Suspicious or illegal activity was detected on your account.</h3>
              <p>Your account has been restricted. You cannot post, view listings, or message normal users.</p>
            </div>
            <button onClick={handleContactSupport} className="btn-contact restricted-allow">
              <MessageSquare size={20} /> Contact Support
            </button>
          </div>
        </div>
      )}
      <div className={isBanned ? 'restricted-mode' : ''}>
        <Navbar />
      </div>
      <div 
        className={`${isBanned ? 'restricted-mode' : ''} ${isBanned ? 'restricted-allow' : ''}`} 
        style={isLandingPage ? {} : { maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/rooms" element={<RoomList />} />
          <Route path="/find-roommates" element={<FindRoommates />} />
          <Route path="/post-room" element={<PostRoom />} />
          <Route path="/edit-room/:id" element={<PostRoom />} />
          <Route path="/roommates" element={<RoommateList />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/admin" element={<AdminDashboard />} />

          <Route path="/banned" element={<BannedPage />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;
