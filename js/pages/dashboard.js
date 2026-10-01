import { getCurrentUser, onAuthStateChanged } from '../auth/auth.js';
import { getRecentTransactions } from '../services/transaction-service.js';
import { getInventoryItems } from '../services/inventory-service.js';
import { formatDate } from '../utils/helpers.js';

function renderDashboardSkeletons() {
  const statIds = ['totalItems', 'totalQuantity', 'lowStockCount', 'recentTransactionsCount'];
  statIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skeleton skeleton-text" style="width: 50px;">&nbsp;</span>';
  });

  const activityFeed = document.getElementById('activityFeed');
  if (activityFeed) {
    activityFeed.innerHTML = `
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    `;
  }

  const lowStockSummary = document.getElementById('lowStockSummary');
  if (lowStockSummary) {
    lowStockSummary.innerHTML = `
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    `;
  }
}

async function loadDashboard() {
  const user = getCurrentUser();
  if (!user) return;

  renderDashboardSkeletons();

  try {
    const [inventory, transactions] = await Promise.all([
      getInventoryItems(),
      getRecentTransactions(6)
    ]);

    // In-memory calculation avoids duplicate Firestore inventory query
    const lowStockItems = inventory.filter((item) =>
      Number(item.stock ?? item.quantity ?? 0) <= Number(item.minimumStock ?? item.minimumQuantity ?? 0)
    );

    const totalQuantity = inventory.reduce((sum, item) => sum + Number(item.stock ?? item.quantity ?? 0), 0);
    const lowStockCount = lowStockItems.length;

    document.getElementById('totalItems').textContent = String(inventory.length);
    document.getElementById('totalQuantity').textContent = String(totalQuantity);
    document.getElementById('lowStockCount').textContent = String(lowStockCount);
    document.getElementById('recentTransactionsCount').textContent = String(transactions.length);

    const activityFeed = document.getElementById('activityFeed');
    if (!transactions.length) {
      activityFeed.innerHTML = '<div class="empty-state">No activity yet.</div>';
    } else {
      activityFeed.innerHTML = transactions
        .map((transaction) => `
          <div class="activity-item">
            <div>
              <strong>${transaction.employeeName || 'Employee'}</strong>
              <span>${transaction.type === 'STOCK_IN' ? 'added' : 'removed'} ${transaction.quantity} ${transaction.itemName}</span>
            </div>
            <small>${formatDate(transaction.createdAt)}</small>
          </div>
        `)
        .join('');
    }

    const lowStockSummary = document.getElementById('lowStockSummary');
    const lowStockToShow = lowStockItems.slice(0, 5);
    lowStockSummary.innerHTML = lowStockToShow.length
      ? lowStockToShow.map((item) => `
          <div class="stack-row">
            <div>
              <strong>${item.name}</strong>
              <div class="small-muted">${item.stock ?? item.quantity ?? 0} / ${item.minimumStock ?? item.minimumQuantity ?? 0}</div>
            </div>
            <span class="chip warning">Low</span>
          </div>
        `).join('')
      : '<div class="empty-state">No low stock alerts.</div>';

  } catch (error) {
    console.error('Unable to load dashboard:', error);
    document.getElementById('activityFeed').innerHTML = `
      <div class="empty-state">
        <p>Unable to load activity right now.</p>
        <button id="retryDashboardBtn" class="btn btn-secondary" style="margin-top: 8px;">Try Again</button>
      </div>
    `;
    document.getElementById('lowStockSummary').innerHTML = '<div class="empty-state">Unable to load stock alerts.</div>';
    document.getElementById('retryDashboardBtn')?.addEventListener('click', loadDashboard);
  }
}

onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = './login.html';
    return;
  }
  loadDashboard();
});
