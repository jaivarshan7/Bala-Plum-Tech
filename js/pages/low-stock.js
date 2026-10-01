import { getLowStockItems } from '../services/inventory-service.js';
import { getCurrentUser, onAuthStateChanged } from '../auth/auth.js';

function renderLowStockSkeletons() {
  const list = document.getElementById('lowStockList');
  if (!list) return;
  list.innerHTML = Array.from({ length: 4 }).map(() => `
    <div class="skeleton skeleton-row"></div>
  `).join('');
}

async function loadLowStock() {
  const list = document.getElementById('lowStockList');
  if (!list) return;

  renderLowStockSkeletons();

  try {
    const items = await getLowStockItems();

    if (!items.length) {
      list.innerHTML = '<div class="empty-state">No low stock items. All inventory levels are healthy!</div>';
      return;
    }

    list.innerHTML = items.map((item) => `
      <div class="stack-row panel">
        <div>
          <a href="./item-details.html?id=${item.id}"><strong>${item.name}</strong></a>
          <div class="small-muted">${item.category} · ${item.subcategory || 'Uncategorised'} · ${item.storageLocation || 'No location'}</div>
        </div>
        <div>
          <span class="chip warning">${item.stock ?? item.quantity ?? 0} / ${item.minimumStock ?? item.minimumQuantity ?? 0}</span>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Unable to load low stock items:', error);
    list.innerHTML = `
      <div class="empty-state">
        <p>Unable to load low stock items right now.</p>
        <button id="retryLowStockBtn" class="btn btn-secondary" style="margin-top: 8px;">Try Again</button>
      </div>
    `;
    document.getElementById('retryLowStockBtn')?.addEventListener('click', loadLowStock);
  }
}

onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = './login.html';
    return;
  }
  loadLowStock();
});
