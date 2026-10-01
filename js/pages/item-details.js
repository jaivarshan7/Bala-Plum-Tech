import { getCurrentUser, onAuthStateChanged } from '../auth/auth.js';
import { getFirebaseServices } from '../firebase/firebase-config.js';
import { getItemById, getInventoryStatus, updateInventoryItem } from '../services/inventory-service.js';
import { getTransactionsForItem, createTransaction } from '../services/transaction-service.js';
import { formatDate } from '../utils/helpers.js';

const { db } = getFirebaseServices();
const urlParams = new URLSearchParams(window.location.search);
const itemId = urlParams.get('id');

function renderItemDetailsSkeletons() {
  const container = document.getElementById('itemDetailView');
  if (!container) return;
  container.innerHTML = `
    <div class="item-card">
      <div class="skeleton skeleton-row" style="width: 60%; height: 32px;"></div>
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
    <div class="item-card">
      <div class="skeleton skeleton-row" style="width: 40%; height: 32px;"></div>
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
  `;
}

async function loadItemDetails() {
  const user = getCurrentUser();
  if (!user) return;

  const container = document.getElementById('itemDetailView');
  if (!container) return;

  if (!itemId) {
    container.innerHTML = `
      <div class="panel empty-state">
        <p>No inventory item ID provided.</p>
        <a href="./inventory.html" class="btn btn-primary" style="margin-top: 10px; display: inline-block;">Return to Inventory</a>
      </div>
    `;
    return;
  }

  renderItemDetailsSkeletons();

  try {
    const [item, transactions] = await Promise.all([
      getItemById(itemId),
      getTransactionsForItem(itemId)
    ]);

    if (!item) {
      container.innerHTML = `
        <div class="panel empty-state">
          <p>Inventory item could not be found.</p>
          <a href="./inventory.html" class="btn btn-primary" style="margin-top: 10px; display: inline-block;">Return to Inventory</a>
        </div>
      `;
      return;
    }

    const status = getInventoryStatus(item);
    const currentStock = Number(item.stock ?? item.quantity ?? 0);

    const content = `
      <div class="item-card">
        <div class="detail-meta">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            <h2>${item.name}</h2>
            <span class="status-pill ${status.className}">${status.label}</span>
          </div>
          <div class="info-row"><span>SKU</span><strong>${item.sku || '—'}</strong></div>
          <div class="info-row"><span>Category</span><strong>${item.category || '—'}</strong></div>
          <div class="info-row"><span>Subcategory</span><strong>${item.subcategory || '—'}</strong></div>
          <div class="info-row"><span>Brand</span><strong>${item.brand || '—'}</strong></div>
          <div class="info-row"><span>Size</span><strong>${item.size || '—'}</strong></div>
          <div class="info-row"><span>Stock</span><strong id="itemStockDisplay">${currentStock}</strong></div>
          <div class="info-row"><span>Minimum</span><strong>${item.minimumStock ?? item.minimumQuantity ?? 0}</strong></div>
          <div class="info-row"><span>Unit</span><strong>${item.unit || '—'}</strong></div>
          <div class="info-row"><span>Storage</span><strong>${item.storageLocation || '—'}</strong></div>
          <div class="info-row"><span>Unit Cost</span><strong>${item.unitCost ? '₹' + item.unitCost : '—'}</strong></div>
        </div>
        <div style="margin-top: 20px;">
          <a href="./inventory.html" class="btn btn-secondary">← Back to Inventory</a>
        </div>
      </div>

      <div class="item-card">
        <h2>Recent Activity</h2>
        <div class="detail-meta" style="margin-top: 18px;">
          ${transactions.length ? transactions.map((tx) => `
            <div class="info-row">
              <span>${formatDate(tx.createdAt)}</span>
              <strong>${tx.type === 'STOCK_IN' ? '➕ In' : '➖ Out'}: ${tx.quantity} (${tx.employeeName || 'Staff'})</strong>
            </div>
          `).join('') : '<div class="empty-box">No recent transactions for this item.</div>'}
        </div>
      </div>
    `;

    container.innerHTML = content;

  } catch (error) {
    console.error('Unable to load item details:', error);
    container.innerHTML = `
      <div class="panel empty-state">
        <p>Unable to load item details. Please check your connection.</p>
        <button id="retryItemBtn" class="btn btn-secondary" style="margin-top: 8px;">Try Again</button>
      </div>
    `;
    document.getElementById('retryItemBtn')?.addEventListener('click', loadItemDetails);
  }
}

onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = './login.html';
    return;
  }
  loadItemDetails();
});
