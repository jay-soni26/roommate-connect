import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

import { LanguageProvider } from './context/LanguageContext';
import { SocketProvider } from './context/SocketContext';
import { PushProvider } from './context/PushContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PushProvider>
          <SocketProvider>
            <NotificationProvider>
              <LanguageProvider>
                <App />
              </LanguageProvider>
            </NotificationProvider>
          </SocketProvider>
        </PushProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
