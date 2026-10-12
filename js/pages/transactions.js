import { getFirebaseServices } from '../firebase/firebase-config.js';
import { getCurrentUser } from '../auth/auth.js';
import { formatDate, showAppLoader, initCoordinator } from '../utils/helpers.js';
import { initializeRouteGuard } from '../auth/route-guard.js';

const { db } = getFirebaseServices();
const transactionTypeFilter = document.getElementById('transactionTypeFilter');
const transactionDateFilter = document.getElementById('transactionDateFilter');
const transactionSearch = document.getElementById('transactionSearch');
const transactionTableBody = document.getElementById('transactionTableBody');

let transactions = [];

function renderTransactionSkeletons() {
  transactionTableBody.innerHTML = Array.from({ length: 6 }).map(() => `
    <tr>
      <td><span class="skeleton skeleton-text" style="width: 110px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 140px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 70px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 40px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 40px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 40px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 90px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 100px;">&nbsp;</span></td>
    </tr>
  `).join('');
}

function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function loadTransactions() {
  renderTransactionSkeletons();
  try {
    const snapshot = await db
      .collection('inventoryTransactions')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    transactions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderTransactions();
  } catch (error) {
    console.error('Unable to load transactions:', error);
    transactionTableBody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <p>Unable to load transactions right now.</p>
            <button id="retryTransactionsBtn" class="btn btn-secondary" style="margin-top: 8px;">Try Again</button>
          </div>
        </td>
      </tr>
    `;
    document.getElementById('retryTransactionsBtn')?.addEventListener('click', loadTransactions);
  }
}

function renderTransactions() {
  const query = transactionSearch.value.trim().toLowerCase();
  const typeFilter = transactionTypeFilter.value;
  const dateFilter = transactionDateFilter.value;

  const filtered = transactions.filter((tx) => {
    const searchable = [tx.itemName, tx.employeeName, tx.reason, tx.type].join(' ').toLowerCase();
    const matchesSearch = !query || searchable.includes(query);
    const matchesType = !typeFilter || tx.type === typeFilter;
    const matchesDate = !dateFilter || (tx.createdAt?.toDate ? tx.createdAt.toDate().toISOString().slice(0, 10) === dateFilter : false);
    return matchesSearch && matchesType && matchesDate;
  });

  if (!filtered.length) {
    transactionTableBody.innerHTML = '<tr><td colspan="8"><div class="empty-state">No transaction history found.</div></td></tr>';
    return;
  }

  transactionTableBody.innerHTML = filtered.map((tx) => `
    <tr>
      <td>${formatDate(tx.createdAt)}</td>
      <td><a href="./item-details.html?id=${tx.itemId}"><strong>${tx.itemName}</strong></a></td>
      <td><span class="chip ${tx.type === 'STOCK_IN' ? 'primary' : 'warning'}">${tx.type === 'STOCK_IN' ? 'Stock In' : 'Stock Out'}</span></td>
      <td>${tx.quantity}</td>
      <td>${tx.previousStock ?? '—'}</td>
      <td>${tx.newStock ?? '—'}</td>
      <td>${tx.employeeName || '—'}</td>
      <td>${tx.reason || '—'}</td>
    </tr>
  `).join('');
}

transactionSearch.addEventListener('input', debounce(renderTransactions, 150));
transactionTypeFilter.addEventListener('change', renderTransactions);
transactionDateFilter.addEventListener('change', renderTransactions);

initCoordinator.register('pageData', { required: true, description: 'Transaction history' });

initializeRouteGuard({ allowedRoles: ['OWNER', 'EMPLOYEE'] })
  .then(async (auth) => {
    if (!auth) {
      initCoordinator.cancel('pageData');
      return;
    }
    try {
      showAppLoader('Loading transaction history...');
      await loadTransactions();
    } catch (err) {
      console.error('Transactions load error:', err);
    } finally {
      initCoordinator.complete('pageData');
    }
  })
  .catch((err) => {
    console.error('Transactions initialization error:', err);
    initCoordinator.fail('pageData', err);
  });
