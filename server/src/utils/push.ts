import * as webpush from 'web-push';
import dotenv from 'dotenv';

dotenv.config();

const publicKey = (process.env.VAPID_PUBLIC_KEY || '').replace(/['"]/g, '');
const privateKey = (process.env.VAPID_PRIVATE_KEY || '').replace(/['"]/g, '');
const email = (process.env.VAPID_EMAIL || 'mailto:support@roommateconnect.com').replace(/['"]/g, '');

if (publicKey && privateKey) {
  console.log('VAPID details configured successfully.');
  webpush.setVapidDetails(email, publicKey, privateKey);
} else {
  console.error('VAPID keys are MISSING in your .env file!');
}

export const sendPushNotification = async (subscription: any, payload: any) => {
  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    };
    
    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    return { success: true };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error };
  }
};

export default webpush;
