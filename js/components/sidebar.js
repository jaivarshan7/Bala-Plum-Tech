import { getCurrentUser, onAuthStateChanged } from '../auth/auth.js';
import { getCurrentUserProfile } from '../services/user-service.js';

export async function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const user = getCurrentUser();
  if (!user) {
    sidebar.innerHTML = '';
    return;
  }

  const profile = await getCurrentUserProfile(user.uid);
  const role = profile?.role || 'EMPLOYEE';

  const navItems = [
    { label: 'Dashboard', href: './dashboard.html', icon: '🏠' },
    { label: 'Inventory', href: './inventory.html', icon: '📦' },
    { label: 'Bulk Add Items', href: './bulk-inventory.html', icon: '📑' },
    { label: 'Transactions', href: './transactions.html', icon: '📜' },
    { label: 'Low Stock', href: './low-stock.html', icon: '⚠️' },
    ...(role === 'OWNER' ? [{ label: 'Employees', href: './employees.html', icon: '👥' }, { label: 'Settings', href: './settings.html', icon: '⚙️' }] : [])
  ];

  const current = window.location.pathname.split('/').pop() || 'dashboard.html';

  sidebar.innerHTML = `
    <div class="brand-box">
      <div class="brand-mark">P</div>
      <div>
        <h2>Bala Plumb Tech</h2>
      </div>
    </div>
    <nav class="nav-list">
      ${navItems
        .map((item) => {
          const isActive = current === item.href.split('/').pop();
          return `
            <a class="nav-item ${isActive ? 'active' : ''}" href="${item.href}">
              <span>${item.icon}</span>
              <span>${item.label}</span>
            </a>
          `;
        })
        .join('')}
    </nav>
  `;
}

onAuthStateChanged((user) => {
  if (!user) {
    if (window.location.search.includes('test=true')) return;
    window.location.href = './login.html';
    return;
  }
  renderSidebar().catch((error) => console.error('Unable to render sidebar:', error));
});
