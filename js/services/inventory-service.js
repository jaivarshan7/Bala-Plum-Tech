import { getFirebaseServices } from '../firebase/firebase-config.js';
import { getStatusFromQuantity } from '../utils/helpers.js';

const { db } = getFirebaseServices();

let cachedInventory = null;
let inventoryCacheTimestamp = 0;
let inventoryFetchPromise = null;
const CACHE_TTL_MS = 30000; // 30 seconds fresh cache

export async function getInventoryItems(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedInventory && (now - inventoryCacheTimestamp < CACHE_TTL_MS)) {
    return cachedInventory;
  }
  if (!forceRefresh && inventoryFetchPromise) {
    return inventoryFetchPromise;
  }

  inventoryFetchPromise = (async () => {
    try {
      const snap = await db.collection('inventory').where('active', '!=', false).get();
      cachedInventory = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      inventoryCacheTimestamp = Date.now();
      return cachedInventory;
    } finally {
      inventoryFetchPromise = null;
    }
  })();

  return inventoryFetchPromise;
}

export function invalidateInventoryCache() {
  cachedInventory = null;
  inventoryCacheTimestamp = 0;
  inventoryFetchPromise = null;
}

export async function getItemById(itemId) {
  if (cachedInventory) {
    const found = cachedInventory.find((item) => item.id === itemId);
    if (found) return found;
  }
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
  invalidateInventoryCache();
  return ref.id;
}

export async function updateInventoryItem(itemId, itemData) {
  await db.collection('inventory').doc(itemId).update({
    ...itemData,
    updatedAt: new Date()
  });
  invalidateInventoryCache();
}

export async function getLowStockItems(forceRefresh = false) {
  const inventory = await getInventoryItems(forceRefresh);
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
