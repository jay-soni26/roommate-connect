import { prisma } from './index';
import { getIO } from '../socket';

export const logAdminAction = async (adminId: number, adminName: string, action: string, details: string, targetId?: string) => {
    try {
        const log = await prisma.adminLog.create({
            data: {
                adminId,
                adminName,
                action,
                details,
                targetId: targetId ? String(targetId) : undefined
            }
        });

        // Broadcast to all admins for real-time log updates
        getIO().emit('adminActionLogged', log);
    } catch (error) {
        console.error('Failed to create admin log:', error);
    }
};
