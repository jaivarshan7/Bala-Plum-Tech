import { getCurrentUser, onAuthStateChanged } from '../auth/auth.js';
import { getFirebaseServices } from '../firebase/firebase-config.js';
import { getRecentTransactions } from '../services/transaction-service.js';
import { getInventoryItems, getLowStockItems } from '../services/inventory-service.js';
import { formatDate } from '../utils/helpers.js';

const { db } = getFirebaseServices();

async function loadDashboard() {
  const user = getCurrentUser();
  if (!user) return;

  const [inventory, transactions] = await Promise.all([getInventoryItems(), getRecentTransactions(6)]);
  const lowStockItems = getLowStockItems();

  const totalQuantity = inventory.reduce((sum, item) => sum + Number(item.stock ?? item.quantity ?? 0), 0);
  const lowStockCount = (await lowStockItems).length;

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
  const lowStockToShow = (await lowStockItems).slice(0, 5);
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

  const userDoc = await db.collection('users').doc(user.uid).get();
  if (userDoc.exists && userDoc.data().role === 'OWNER') {
    // Owner sees all business activity, so nothing extra here.
  }
}

onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = './login.html';
    return;
  }
  loadDashboard().catch((error) => {
    console.error('Unable to load dashboard:', error);
    document.getElementById('activityFeed').innerHTML = '<div class="empty-state">Unable to load activity right now.</div>';
    document.getElementById('lowStockSummary').innerHTML = '<div class="empty-state">Unable to load stock alerts right now.</div>';
  });
});
