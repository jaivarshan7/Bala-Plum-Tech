import { getFirebaseServices } from '../firebase/firebase-config.js';
import { formatDate } from '../utils/helpers.js';

const { db } = getFirebaseServices();
const transactionTypeFilter = document.getElementById('transactionTypeFilter');
const transactionDateFilter = document.getElementById('transactionDateFilter');
const transactionSearch = document.getElementById('transactionSearch');
const transactionTableBody = document.getElementById('transactionTableBody');

let transactions = [];

async function loadTransactions() {
  const snapshot = await db.collection('inventoryTransactions').orderBy('createdAt', 'desc').get();
  transactions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  renderTransactions();
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
      <td>${tx.itemName}</td>
      <td>${tx.type}</td>
      <td>${tx.quantity}</td>
      <td>${tx.previousQuantity}</td>
      <td>${tx.newQuantity}</td>
      <td>${tx.employeeName}</td>
      <td>${tx.reason || '—'}</td>
    </tr>
  `).join('');
}

transactionSearch.addEventListener('input', renderTransactions);
transactionTypeFilter.addEventListener('change', renderTransactions);
transactionDateFilter.addEventListener('change', renderTransactions);

loadTransactions();
