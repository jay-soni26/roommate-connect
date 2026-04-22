import axios from 'axios';

const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

export const API_BASE = isProduction 
    ? `https://${window.location.hostname}` 
    : `http://${window.location.hostname}:3000`;

const api = axios.create({
    baseURL: isProduction ? `${API_BASE}/api` : `${API_BASE}/api`,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
