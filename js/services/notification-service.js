import { getFirebaseServices } from '../firebase/firebase-config.js';

const { db } = getFirebaseServices();

export async function createNotification({ userId, title, message, type = 'SYSTEM' }) {
  await db.collection('notifications').add({
    userId,
    title,
    message,
    type,
    isRead: false,
    createdAt: new Date()
  });
}

export async function getNotificationsForUser(userId) {
  const snapshot = await db
    .collection('notifications')
    .where('userId', '==', userId)
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((first, second) => getTime(second.createdAt) - getTime(first.createdAt))
    .slice(0, 10);
}

function getTime(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  return new Date(value).getTime() || 0;
}

export async function markNotificationAsRead(notificationId) {
  await db.collection('notifications').doc(notificationId).update({ isRead: true });
}

export async function markAllNotificationsAsRead(userId) {
  const notifications = await getNotificationsForUser(userId);
  const batch = db.batch();

  notifications
    .filter((notification) => !notification.isRead)
    .forEach((notification) => {
      batch.update(db.collection('notifications').doc(notification.id), { isRead: true });
    });

  await batch.commit();
}
