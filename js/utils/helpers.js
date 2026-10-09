export function formatDate(dateValue) {
  if (!dateValue) return '—';
  const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';
}

export function getStatusFromQuantity(quantity, minimumQuantity) {
  if (quantity <= 0) return 'out-of-stock';
  if (quantity <= minimumQuantity) return 'low-stock';
  return 'in-stock';
}

export function toCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function safeText(value) {
  return value ?? '';
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function showToast(message, type = 'success', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function showAppLoader(text = 'Loading Bala Plumb Tech...') {
  let loader = document.getElementById('appLoader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'appLoader';
    loader.className = 'app-loader-overlay';
    loader.innerHTML = `
      <div class="app-loader-spinner" aria-hidden="true"></div>
      <div class="app-loader-brand">Bala Plumb Tech</div>
      <div class="app-loader-text">${escapeHtml(text)}</div>
    `;
    document.body.prepend(loader);
  }
}

export function hideAppLoader() {
  const loader = document.getElementById('appLoader');
  if (loader) {
    loader.classList.add('fade-out');
    setTimeout(() => {
      if (loader.parentNode) loader.remove();
    }, 280);
  }
}
