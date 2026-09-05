import { getCurrentUser } from '../auth/auth.js';
import { getFirebaseServices } from '../firebase/firebase-config.js';
import { getItemById, getInventoryStatus } from '../services/inventory-service.js';
import { getTransactionsForItem } from '../services/transaction-service.js';
import { formatDate } from '../utils/helpers.js';

const { db } = getFirebaseServices();
const urlParams = new URLSearchParams(window.location.search);
const itemId = urlParams.get('id');

async function loadItemDetails() {
  const user = getCurrentUser();
  if (!user || !itemId) return;

  const item = await getItemById(itemId);
  if (!item) {
    document.getElementById('itemDetailView').innerHTML = '<div class="empty-state">Item not found.</div>';
    return;
  }

  const transactions = await getTransactionsForItem(itemId);
  const status = getInventoryStatus(item);

  const content = `
    <div class="item-card">
      <div class="detail-meta">
        <h2>${item.name}</h2>
        <span class="status-pill ${status.className}">${status.label}</span>
        <div class="info-row"><span>SKU</span><strong>${item.sku}</strong></div>
        <div class="info-row"><span>Category</span><strong>${item.category || '—'}</strong></div>
        <div class="info-row"><span>Subcategory</span><strong>${item.subcategory || '—'}</strong></div>
        <div class="info-row"><span>Brand</span><strong>${item.brand || '—'}</strong></div>
        <div class="info-row"><span>Size</span><strong>${item.size || '—'}</strong></div>
        <div class="info-row"><span>Stock</span><strong>${item.stock ?? item.quantity ?? 0}</strong></div>
        <div class="info-row"><span>Minimum</span><strong>${item.minimumStock ?? item.minimumQuantity ?? 0}</strong></div>
        <div class="info-row"><span>Unit</span><strong>${item.unit || '—'}</strong></div>
        <div class="info-row"><span>Storage</span><strong>${item.storageLocation || '—'}</strong></div>
        <div class="info-row"><span>Unit Cost</span><strong>${item.unitCost ?? '—'}</strong></div>
      </div>
    </div>

    <div class="item-card">
      <h2>Recent Activity</h2>
      <div class="quick-actions">
        <button class="btn btn-primary">➕ Stock In</button>
        <button class="btn btn-secondary">➖ Stock Out</button>
      </div>
      <div class="detail-meta" style="margin-top: 18px;">
        ${transactions.length ? transactions.map((tx) => `
          <div class="info-row">
            <span>${formatDate(tx.createdAt)}</span>
            <strong>${tx.type} · ${tx.quantity}</strong>
          </div>
        `).join('') : '<div class="empty-box">No recent transactions for this item.</div>'}
      </div>
    </div>
  `;

  document.getElementById('itemDetailView').innerHTML = content;
}

loadItemDetails();
