import { getLowStockItems } from '../services/inventory-service.js';

async function loadLowStock() {
  const items = await getLowStockItems();
  const list = document.getElementById('lowStockList');

  if (!items.length) {
    list.innerHTML = '<div class="empty-state">No low stock items.</div>';
    return;
  }

  list.innerHTML = items.map((item) => `
    <div class="stack-row panel">
      <div>
        <strong>${item.name}</strong>
        <div class="small-muted">${item.category} · ${item.subcategory || 'Uncategorised'} · ${item.storageLocation || 'No location'}</div>
      </div>
      <div>
        <span class="chip warning">${item.stock ?? item.quantity ?? 0} / ${item.minimumStock ?? item.minimumQuantity ?? 0}</span>
      </div>
    </div>
  `).join('');
}

loadLowStock();
