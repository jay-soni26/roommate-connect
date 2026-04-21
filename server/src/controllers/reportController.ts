import { Request, Response } from 'express';
import { prisma } from '../utils';
import { getIO } from '../socket';
import { AuthRequest } from '../middleware/auth';
import { sendPushNotification } from '../utils/push';
import { isUserOnline } from '../socket';

export const createReport = async (req: AuthRequest, res: Response) => {
    try {
        const { reportedUserId, chatId, reason, evidence } = req.body;
        const reporterId = req.user!.id;

        if (reporterId === Number(reportedUserId)) {
            return res.status(400).json({ error: 'You cannot report yourself' });
        }

        // Generate custom report ID: RC + random numbers
        const lastReport = await prisma.report.findFirst({
            orderBy: { id: 'desc' }
        });
        const nextId = (lastReport?.id || 0) + 1;
        const reportId = `RC${String(nextId).padStart(3, '0')}`;

        const report = await prisma.report.create({
            data: {
                reportId,
                reporterId,
                reportedUserId: Number(reportedUserId),
                chatId: chatId ? Number(chatId) : null,
                reason,
                evidence,
                status: 'PENDING'
            },
            include: {
                reporter: { select: { name: true } },
                reportedUser: { select: { name: true } }
            }
        });

        // Notify Super Admins
        getIO().emit('newReport', report);

        // Immediate confirmation notification to reporter
        await prisma.notification.create({
            data: {
                userId: reporterId,
                type: 'REPORT_UPDATE',
                title: 'Report Received',
                message: `Hi ${report.reporter.name}, we received your report ${reportId} against ${report.reportedUser.name}. Our team is investigating.`,
                data: JSON.stringify({ reportId })
            }
        });
        getIO().to(`user_${reporterId}`).emit('notification');

        // Push Confirmation - ONLY IF OFFLINE
        if (!isUserOnline(reporterId)) {
            const reporterSubs = await prisma.pushSubscription.findMany({ where: { userId: reporterId } });
            for (const sub of reporterSubs) {
                await sendPushNotification(sub, {
                    title: 'Report Received',
                    body: `Report ${reportId} received. Our team is investigating.`,
                    url: 'http://localhost:5173/'
                });
            }
        }

        res.json({ success: true, reportId });
    } catch (error: any) {
        console.error('Report Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

export const getReports = async (req: Request, res: Response) => {
    try {
        const reports = await prisma.report.findMany({
            include: {
                reporter: { select: { id: true, name: true, email: true } },
                reportedUser: { select: { id: true, name: true, email: true, isBanned: true } },
                chat: { include: { messages: { take: 50, orderBy: { createdAt: 'desc' } } } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Enrich with violation history
        const enrichedReports = await Promise.all(reports.map(async (r) => {
            const previousViolations = await prisma.report.count({
                where: {
                    reportedUserId: r.reportedUserId,
                    status: 'RESOLVED',
                    adminAction: { in: ['BAN', 'WARNING'] },
                    id: { not: r.id }
                }
            });
            
            const totalReports = await prisma.report.count({
                where: { 
                    reportedUserId: r.reportedUserId,
                    id: { not: r.id } 
                }
            });

            return {
                ...r,
                previousViolations,
                totalReportsCount: totalReports
            };
        }));

        res.json(enrichedReports);
    } catch (error) {
        console.error('getReports Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

export const handleReportAction = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { action, adminNote } = req.body; // action: BAN, WARNING, NONE

        const report = await prisma.report.findUnique({
            where: { id: Number(id) },
            include: { 
                reporter: { select: { id: true, name: true } },
                reportedUser: { select: { id: true, name: true, email: true } }
            }
        });

        if (!report) return res.status(404).json({ error: 'Report not found' });
        if (report.status !== 'PENDING') return res.status(400).json({ error: 'This report has already been resolved' });

        await prisma.report.update({
            where: { id: Number(id) },
            data: { status: 'RESOLVED', adminAction: action, adminNote }
        });

        const reportedId = report.reportedUserId;
        const reporterId = report.reporterId;

        const brand = "RoommateConnect Official";

        if (action === 'BAN') {
            await prisma.user.update({
                where: { id: reportedId },
                data: { isBanned: true, banReason: adminNote || 'Multiple reports or severe violation' }
            });
            
            // Notify Reported User
            await prisma.notification.create({
              data: {
                  userId: reportedId,
                  type: 'SYSTEM',
                  title: 'Account Restricted',
                  message: `Something suspicious happened or multiple users reported you. Your account is now restricted.`,
              }
            });
            
            // Push ONLY IF OFFLINE
            if (!isUserOnline(reportedId)) {
                const bannedSubs = await prisma.pushSubscription.findMany({ where: { userId: reportedId } });
                for (const sub of bannedSubs) {
                    await sendPushNotification(sub, { title: 'Account Restricted', body: 'Your account access has been limited due to policy violations.', url: 'http://localhost:5173/' });
                }
            }

            getIO().to(`user_${reportedId}`).emit('accountBanned');

            // Thank Reporter
            const reporterMsg = `Update: We have banned the user you reported for ${report.reason}. Thank you for keeping our community safe.`;
            await prisma.notification.create({
              data: {
                  userId: reporterId,
                  type: 'REPORT_UPDATE',
                  title: `${brand}: Action Taken`,
                  message: reporterMsg,
              }
            });

            // Push ONLY IF OFFLINE
            if (!isUserOnline(reporterId)) {
                const reporterSubs = await prisma.pushSubscription.findMany({ where: { userId: reporterId } });
                for (const sub of reporterSubs) {
                    await sendPushNotification(sub, { title: 'Report Update', body: reporterMsg, url: 'http://localhost:5173/' });
                }
            }

        } else if (action === 'WARNING') {
            const strikeCount = await prisma.report.count({
                where: { 
                    reportedUserId: reportedId, 
                    status: 'RESOLVED', 
                    adminAction: { in: ['BAN', 'WARNING'] } 
                }
            });

            const warnMsg = `We received community reports regarding your behavior. This is strike ${strikeCount}. Multiple strikes will lead to a permanent account ban.`;
            // Send Warning with strike count
            await prisma.notification.create({
              data: {
                  userId: reportedId,
                  type: 'WARNING',
                  title: `${brand}: Violation Warning (Strike ${strikeCount})`,
                  message: warnMsg,
              }
            });

            // Push ONLY IF OFFLINE
            if (!isUserOnline(reportedId)) {
                const warnedSubs = await prisma.pushSubscription.findMany({ where: { userId: reportedId } });
                for (const sub of warnedSubs) {
                    await sendPushNotification(sub, { title: 'Violation Warning', body: warnMsg, url: 'http://localhost:5173/' });
                }
            }
            
            // Thank Reporter
            const reportActionMsg = `We have issued a formal last warning to ${report.reportedUser.name}. We are monitoring the situation closely.`;
            await prisma.notification.create({
              data: {
                  userId: reporterId,
                  type: 'REPORT_UPDATE',
                  title: `${brand}: Report Resolved`,
                  message: reportActionMsg,
              }
            });

            // Push ONLY IF OFFLINE
            if (!isUserOnline(reporterId)) {
                const reporterSubs = await prisma.pushSubscription.findMany({ where: { userId: reporterId } });
                for (const sub of reporterSubs) {
                    await sendPushNotification(sub, { title: 'Report Update', body: reportActionMsg, url: 'http://localhost:5173/' });
                }
            }
        } else {
            // Dismiss
            const dismissMsg = `Regarding your report ${report.reportId}, we found some misunderstanding or insufficient evidence to block. We've archived it for now.`;
            await prisma.notification.create({
              data: {
                  userId: reporterId,
                  type: 'REPORT_UPDATE',
                  title: `${brand}: Report Update`,
                  message: dismissMsg,
              }
            });

            // Push ONLY IF OFFLINE
            if (!isUserOnline(reporterId)) {
                const reporterSubs = await prisma.pushSubscription.findMany({ where: { userId: reporterId } });
                for (const sub of reporterSubs) {
                    await sendPushNotification(sub, { title: 'Report Update', body: dismissMsg, url: 'http://localhost:5173/' });
                }
            }
        }

        getIO().to(`user_${reporterId}`).emit('notification');
        getIO().to(`user_${reportedId}`).emit('notification');

        // Notify Admins to refresh stats and list
        getIO().emit('reportStatsUpdate');

        res.json({ success: true });
    } catch (error) {
        console.error('Report Action Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};
