import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { z } from 'zod';
import { getIO } from '../socket';

const registerSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    phoneNumber: z.string().optional(),
    role: z.enum(['USER', 'OWNER', 'ADMIN']).optional(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, name, phoneNumber, role } = registerSchema.parse(req.body);

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'This email is already registered' });
        }

        // Check if email is permanently banned
        const isPermanentlyBanned = await prisma.bannedEmail.findUnique({ where: { email } });
        if (isPermanentlyBanned) {
            return res.status(403).json({ error: 'This email has been permanently banned due to suspicious activity and illegal content violations.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                phoneNumber,
                role: role || 'USER',
            },
        });

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        
        // Real-time update for Admins (Analytics/Counters)
        getIO().emit('userCreated', { id: user.id, name: user.name });

        res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues[0].message, details: error.issues });
        }
        res.status(400).json({ error: 'Registration failed' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { email },
            include: { profile: { select: { avatar: true } } }
        });

        if (!user) {
            return res.status(404).json({ error: "Account doesn't exist, please register" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid password. Please try again.' });
        }
        
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

        res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.profile?.avatar, isBanned: user.isBanned } });
    } catch (error) {
        console.error('Login error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues[0].message });
        }
        res.status(500).json({
            error: 'Login failed',
            details: error instanceof Error ? error.message : 'Unknown server error'
        });
    }
};
