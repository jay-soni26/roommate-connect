import React, { createContext, useContext, useState } from 'react';

type Language = 'en' | 'hi';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
    en: {
        'nav.findRooms': 'Find Rooms',
        'nav.findRoommates': 'Find Roommates',
        'nav.postRoom': 'Post Room',
        'nav.login': 'Login',
        'nav.register': 'Register',
        'profile.title': 'Profile',
        'profile.edit': 'Edit Profile',
        'profile.myListings': 'My Listings',
        'profile.settings': 'Settings',
        'settings.account': 'Account Settings',
        'settings.security': 'Security',
        'settings.notifications': 'Notifications',
        'settings.privacy': 'Privacy',
        'settings.appearance': 'Appearance',
        'settings.language': 'Language & Region',
        'settings.deleteAccount': 'Delete Account',
        'settings.changePassword': 'Change Password',
        'home.title': 'Connecting Roommates, Building Communities',
        'home.subtitle': 'The smartest way to find your next home and the perfect people to share it with.',
    },
    hi: {
        'nav.findRooms': 'कमरे खोजें',
        'nav.findRoommates': 'रुममेट खोजें',
        'nav.postRoom': 'कमरा पोस्ट करें',
        'nav.login': 'लॉगिन',
        'nav.register': 'रजिस्टर',
        'profile.title': 'प्रोफ़ाइल',
        'profile.edit': 'प्रोफ़ाइल संपादित करें',
        'profile.myListings': 'मेरी लिस्टिंग',
        'profile.settings': 'सेटिंग्स',
        'settings.account': 'खाता सेटिंग्स',
        'settings.security': 'सुरक्षा',
        'settings.notifications': 'सूचनाएं',
        'settings.privacy': 'गोपनीयता',
        'settings.appearance': 'दिखावट',
        'settings.language': 'भाषा और क्षेत्र',
        'settings.deleteAccount': 'खाता हटाएँ',
        'settings.changePassword': 'पासवर्ड बदलें',
        'home.title': 'रुममेट्स को जोड़ना, समुदायों का निर्माण',
        'home.subtitle': 'अपना अगला घर और उसे साझा करने के लिए सही लोगों को खोजने का सबसे स्मार्ट तरीका।',
    }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(() => {
        return (localStorage.getItem('language') as Language) || 'en';
    });

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('language', lang);
    };

    const t = (key: string) => {
        return translations[language][key] || translations['en'][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
