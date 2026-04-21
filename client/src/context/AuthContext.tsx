import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
    id: number;
    email: string;
    name: string;
    role: 'USER' | 'OWNER' | 'ADMIN' | 'SUPER_ADMIN';
    avatar?: string;
    isBanned?: boolean;
}

interface AuthContextType {
    user: User | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    setBanned: (val: boolean) => void;
    updateUser: (userData: Partial<User>) => void;
    isLoading: boolean;
    isBanned: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isBanned, setIsBanned] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        if (token && savedUser) {
            const parsed = JSON.parse(savedUser);
            setUser(parsed);
            if (parsed.isBanned) setIsBanned(true);
        }
        setIsLoading(false);
    }, []);

    const setBanned = (val: boolean) => setIsBanned(val);

    const login = (token: string, userData: User) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    const updateUser = (userData: Partial<User>) => {
        if (user) {
            const updatedUser = { ...user, ...userData };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setUser(updatedUser);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, setBanned, updateUser, isLoading, isBanned }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
