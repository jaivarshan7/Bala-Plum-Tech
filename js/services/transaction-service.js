import { getFirebaseServices } from '../firebase/firebase-config.js';
import { getCurrentUser } from '../auth/auth.js';

const { db } = getFirebaseServices();

export async function createTransaction({ itemId, itemName, type, quantity, previousQuantity, newQuantity, reason, notes }) {
  const user = getCurrentUser();
  const userSnap = await db.collection('users').doc(user.uid).get();
  const employeeName = userSnap.exists ? userSnap.data().fullName || user.email : user.email;

  const payload = {
    itemId,
    itemName,
    userId: user.uid,
    employeeName,
    type,
    quantity,
    previousQuantity,
    newQuantity,
    reason,
    notes: notes || '',
    createdAt: new Date()
  };

  await db.collection('inventoryTransactions').add(payload);
  return payload;
}

export async function getRecentTransactions(limit = 6) {
  const snapshot = await db
    .collection('inventoryTransactions')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getTransactionsForItem(itemId) {
  const snapshot = await db
    .collection('inventoryTransactions')
    .where('itemId', '==', itemId)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
