import { getFirebaseServices } from '../firebase/firebase-config.js';
import { getStatusFromQuantity } from '../utils/helpers.js';

const { db } = getFirebaseServices();

export async function getInventoryItems() {
  const snap = await db.collection('inventory').where('active', '!=', false).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getItemById(itemId) {
  const doc = await db.collection('inventory').doc(itemId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function createInventoryItem(itemData) {
  const payload = {
    ...itemData,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const ref = await db.collection('inventory').add(payload);
  return ref.id;
}

export async function updateInventoryItem(itemId, itemData) {
  await db.collection('inventory').doc(itemId).update({
    ...itemData,
    updatedAt: new Date()
  });
}

export async function getLowStockItems() {
  const inventory = await getInventoryItems();
  return inventory.filter((item) => Number(item.stock ?? item.quantity ?? 0) <= Number(item.minimumStock ?? item.minimumQuantity ?? 0));
}

export function getInventoryStatus(item) {
  const status = getStatusFromQuantity(
    Number(item.stock ?? item.quantity ?? 0),
    Number(item.minimumStock ?? item.minimumQuantity ?? 0)
  );

  if (status === 'in-stock') return { label: 'In Stock', className: 'in-stock' };
  if (status === 'low-stock') return { label: 'Low Stock', className: 'low-stock' };
  return { label: 'Out of Stock', className: 'out-of-stock' };
}
