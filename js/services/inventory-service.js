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

export async function createInventoryItemsBatch(items, onProgress = null) {
  const BATCH_SIZE = 400; // Safe buffer below Firestore's 500-operation limit
  const results = {
    total: items.length,
    successCount: 0,
    failedCount: 0,
    createdIds: [],
    errors: []
  };

  if (!items || !items.length) {
    return results;
  }

  const chunks = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    chunks.push(items.slice(i, i + BATCH_SIZE));
  }

  let processed = 0;
  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    const batch = db.batch();
    const chunkRefs = [];

    for (const item of chunk) {
      const ref = db.collection('inventory').doc();
      const payload = {
        ...item,
        name: String(item.name || '').trim(),
        sku: String(item.sku || '').trim(),
        category: String(item.category || '').trim(),
        subcategory: String(item.subcategory || '').trim(),
        unit: String(item.unit || '').trim(),
        brand: String(item.brand || '').trim(),
        size: String(item.size || '').trim(),
        description: String(item.description || '').trim(),
        storageLocation: String(item.storageLocation || '').trim(),
        imageUrl: String(item.imageUrl || '').trim(),
        stock: Number(item.stock ?? item.quantity ?? 0),
        minimumStock: Number(item.minimumStock ?? item.minimumQuantity ?? 0),
        quantity: Number(item.stock ?? item.quantity ?? 0),
        minimumQuantity: Number(item.minimumStock ?? item.minimumQuantity ?? 0),
        unitCost: item.unitCost !== '' && item.unitCost !== null && item.unitCost !== undefined ? Number(item.unitCost) : 0,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      batch.set(ref, payload);
      chunkRefs.push(ref.id);
    }

    try {
      await batch.commit();
      results.successCount += chunk.length;
      results.createdIds.push(...chunkRefs);
    } catch (err) {
      console.error(`Error committing batch ${c + 1}/${chunks.length}:`, err);
      results.failedCount += chunk.length;
      results.errors.push({
        batchIndex: c,
        itemCount: chunk.length,
        message: err.message || 'Batch commit failed'
      });
    }

    processed += chunk.length;
    if (typeof onProgress === 'function') {
      try {
        onProgress(processed, items.length);
      } catch (progressErr) {
        console.warn('Progress callback error:', progressErr);
      }
    }
  }

  if (results.successCount > 0) {
    invalidateInventoryCache();
  }

  return results;
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
