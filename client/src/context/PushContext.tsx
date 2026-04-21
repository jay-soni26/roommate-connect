import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../api/client';

interface PushContextType {
  isPushSupported: boolean;
  isSubscribed: boolean;
  subscribeUser: () => Promise<void>;
  unsubscribeUser: () => Promise<void>;
}

const PushContext = createContext<PushContextType | undefined>(undefined);

const VAPID_PUBLIC_KEY = "BN6794XxIfJhtsc0uqg18wi8WRfyuzrLMkYzNZayPWxdGOI8ZKl1bhtLIzsG447uhtE94j0MzLIO5agws2S183Q";

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const PushProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    console.log('Checking push support...');
    const hasSW = 'serviceWorker' in navigator;
    const hasPush = 'PushManager' in window;
    
    if (hasSW && hasPush) {
      console.log('Push is supported on this browser.');
      setIsPushSupported(true);
      registerServiceWorker();
    } else {
      console.warn('Push NOT supported. SW:', hasSW, 'Push:', hasPush);
      // In some browsers, PushManager is only available in secure contexts
      if (window.isSecureContext === false) {
        console.error('Push requires a Secure Context (HTTPS or localhost).');
      }
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      setSwRegistration(registration);
      checkSubscription(registration);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  };

  const checkSubscription = async (registration: ServiceWorkerRegistration) => {
    const subscription = await registration.pushManager.getSubscription();
    setIsSubscribed(!!subscription);
    
    // If logged in and subscribed but maybe not in backend, we should sync
    if (user && subscription) {
        sendSubscriptionToBackend(subscription);
    }
  };

  const sendSubscriptionToBackend = async (subscription: PushSubscription) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const subJson = subscription.toJSON();
      await api.post('/push/subscribe', {
        endpoint: subJson.endpoint,
        keys: subJson.keys
      });
    } catch (error) {
      console.error('Failed to sync push subscription with backend:', error);
    }
  };

  const subscribeUser = async () => {
    if (!swRegistration) return;

    try {
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      console.log('User is subscribed:', subscription);
      await sendSubscriptionToBackend(subscription);
      setIsSubscribed(true);
    } catch (error) {
      console.error('Failed to subscribe the user:', error);
      if (Notification.permission === 'denied') {
        alert('Push notifications are blocked in your browser settings.');
      }
    }
  };

  const unsubscribeUser = async () => {
    if (!swRegistration) return;

    try {
      const subscription = await swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        
        await api.post('/push/unsubscribe', {
          endpoint: subscription.endpoint
        });
        
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('Error unsubscribing', error);
    }
  };

  // Auto-prompt/subscribe if user is logged in for the first time or similar?
  // Industry best practice: show a custom UI before browser prompt
  
  return (
    <PushContext.Provider value={{ isPushSupported, isSubscribed, subscribeUser, unsubscribeUser }}>
      {children}
    </PushContext.Provider>
  );
};

export const usePush = () => {
  const context = useContext(PushContext);
  if (context === undefined) {
    throw new Error('usePush must be used within a PushProvider');
  }
  return context;
};
