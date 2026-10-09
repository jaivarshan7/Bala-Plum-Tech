import { getFirebaseServices } from '../firebase/firebase-config.js';
import { getStatusFromQuantity } from '../utils/helpers.js';
import { getCurrentUser } from '../auth/auth.js';
import { getCurrentUserProfile } from './user-service.js';

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
  let cleanImageUrl = String(itemData.imageUrl || '').trim();
  if (cleanImageUrl && !cleanImageUrl.startsWith('http://') && !cleanImageUrl.startsWith('https://')) {
    cleanImageUrl = '';
  }

  const payload = {
    ...itemData,
    imageUrl: cleanImageUrl,
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
        imageUrl: (String(item.imageUrl || '').trim().startsWith('http://') || String(item.imageUrl || '').trim().startsWith('https://')) ? String(item.imageUrl || '').trim() : '',
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
  const sanitized = { ...itemData };
  if ('imageUrl' in sanitized) {
    const cleanImageUrl = String(sanitized.imageUrl || '').trim();
    sanitized.imageUrl = (cleanImageUrl.startsWith('http://') || cleanImageUrl.startsWith('https://')) ? cleanImageUrl : '';
  }
  await db.collection('inventory').doc(itemId).update({
    ...sanitized,
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

/**
 * Concurrency-safe atomic stock adjustment (Stock In / Stock Out).
 * Ensures that item stock and audit transaction records are updated in a single atomic transaction.
 */
export async function adjustInventoryStock({ itemId, type, quantity, reason = '', notes = '' }) {
  if (!itemId) {
    throw new Error('Item ID is required for stock adjustment.');
  }
  if (!['STOCK_IN', 'STOCK_OUT'].includes(type)) {
    throw new Error('Transaction type must be STOCK_IN or STOCK_OUT.');
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Quantity must be a positive number greater than zero.');
  }

  const user = getCurrentUser();
  if (!user) {
    throw new Error('Authentication required to perform stock adjustments.');
  }

  let employeeName = user.displayName || user.email || 'Staff';
  try {
    const profile = await getCurrentUserProfile(user.uid);
    if (profile?.fullName) {
      employeeName = profile.fullName;
    }
  } catch (profileErr) {
    console.warn('Could not fetch employee profile for transaction:', profileErr);
  }

  const itemRef = db.collection('inventory').doc(itemId);
  const txRef = db.collection('inventoryTransactions').doc();

  const txRecord = await db.runTransaction(async (transaction) => {
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists) {
      throw new Error('Inventory item was not found.');
    }

    const itemData = itemSnap.data();
    const currentStock = Number(itemData.stock ?? itemData.quantity ?? 0);
    let newStock;

    if (type === 'STOCK_IN') {
      newStock = currentStock + qty;
    } else {
      if (currentStock < qty) {
        throw new Error(`Insufficient stock. Available stock is ${currentStock}, requested removal is ${qty}.`);
      }
      newStock = currentStock - qty;
    }

    // Atomic update to inventory item
    transaction.update(itemRef, {
      stock: newStock,
      quantity: newStock,
      updatedAt: new Date()
    });

    // Atomic insert of audit transaction log
    const auditRecord = {
      itemId,
      itemName: String(itemData.name || 'Unnamed Item').trim(),
      userId: user.uid,
      employeeName,
      type,
      quantity: qty,
      previousQuantity: currentStock,
      newQuantity: newStock,
      reason: String(reason || '').trim(),
      notes: String(notes || '').trim(),
      createdAt: new Date()
    };

    transaction.set(txRef, auditRecord);

    return {
      id: txRef.id,
      ...auditRecord,
      item: {
        id: itemId,
        ...itemData,
        stock: newStock,
        quantity: newStock
      }
    };
  });

  invalidateInventoryCache();
  return txRecord;
}

export async function stockInItem(itemId, quantity, reason = '', notes = '') {
  return adjustInventoryStock({ itemId, type: 'STOCK_IN', quantity, reason, notes });
}

export async function stockOutItem(itemId, quantity, reason = '', notes = '') {
  return adjustInventoryStock({ itemId, type: 'STOCK_OUT', quantity, reason, notes });
}
