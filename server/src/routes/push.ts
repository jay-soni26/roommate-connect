import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { sendPushNotification } from '../utils/push';
import prisma from '../utils/prisma';

const router = express.Router();

// Save or update push subscription
router.post('/subscribe', authenticateToken, async (req: any, res) => {
  try {
    const { endpoint, keys } = req.body;
    const userId = req.user.id;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ message: 'Invalid subscription object' });
    }

    // Upsert subscription
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth
      },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth
      }
    });

    res.status(201).json({ message: 'Subscription saved successfully' });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ message: 'Failed to save subscription' });
  }
});

// Remove a subscription (optional but good for clean DB)
router.post('/unsubscribe', authenticateToken, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await prisma.pushSubscription.deleteMany({
      where: { endpoint }
    });
    res.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to unsubscribe' });
  }
});

// Test push notification
router.post('/test-push', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
    });

    console.log(`Sending test push to ${subscriptions.length} devices for user ${userId}`);
    
    if (subscriptions.length === 0) {
       return res.status(404).json({ message: 'No devices registered. Try turning the switch OFF and ON again.', error: 'DB_EMPTY' });
    }

    for (const sub of subscriptions) {
      const result = await sendPushNotification(sub, {
        title: 'RoommateConnect Test Alert 🚀',
        body: 'Your device is now synchronized with Jay Soni\'s platform. Notifications are working perfectly!',
        url: 'http://localhost:5173/profile'
      });
      
      if (!result.success) {
        return res.status(500).json({ message: 'Push engine error', error: (result.error as any)?.message || JSON.stringify(result.error) });
      }
    }

    res.json({ message: 'Test notification sent' });
  } catch (error: any) {
    console.error('Test push error:', error);
    res.status(500).json({ message: 'Server crash during push', error: error.message || 'Unknown server error' });
  }
});

export default router;
