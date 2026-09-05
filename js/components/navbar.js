import { getCurrentUser, onAuthStateChanged, signOutUser } from '../auth/auth.js';
import { getFirebaseServices } from '../firebase/firebase-config.js';
import { getInitials } from '../utils/helpers.js';
import { getNotificationsForUser, markAllNotificationsAsRead, markNotificationAsRead } from '../services/notification-service.js';

const { db } = getFirebaseServices();

export async function renderTopbar() {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;

  const user = getCurrentUser();

  if (!user) {
    topbar.innerHTML = '';
    return;
  }

  const snap = await db.collection('users').doc(user.uid).get();
  const data = snap.exists ? snap.data() : {};
  const displayName = data.fullName || user.displayName || 'User';
  const role = data.role || 'EMPLOYEE';
  let notifications = [];

  try {
    notifications = await getNotificationsForUser(user.uid);
  } catch (error) {
    console.error('Unable to load notifications:', error);
  }

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  topbar.innerHTML = `
    <div class="topbar-left">
      <button class="icon-button" aria-label="Sidebar toggle" id="sidebarToggle">☰</button>
    </div>
    <div class="topbar-right">
      <button class="icon-button" id="notificationButton" aria-label="Notifications" aria-expanded="false">
        🔔
        ${unreadCount ? `<span class="badge">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
      </button>
      <div class="profile-chip" id="profileMenuToggle" role="button" tabindex="0" aria-label="Open profile menu">
        <div class="avatar">${getInitials(displayName)}</div>
        <span>${displayName}</span>
      </div>
    </div>
  `;

  const notificationButton = document.getElementById('notificationButton');
  notificationButton?.addEventListener('click', () => {
    const existing = document.getElementById('notificationDropdown');
    if (existing) {
      existing.remove();
      notificationButton.setAttribute('aria-expanded', 'false');
      return;
    }

    const dropdown = document.createElement('div');
    dropdown.id = 'notificationDropdown';
    dropdown.className = 'panel notification-dropdown';
    dropdown.innerHTML = `
      <div class="notification-header">
        <strong>Notifications</strong>
        ${unreadCount ? '<button id="markAllNotifications" class="text-button">Mark all read</button>' : ''}
      </div>
      <div class="notification-list">
        ${notifications.length ? notifications.map((notification) => `
          <button class="notification-item ${notification.isRead ? '' : 'unread'}" data-notification-id="${notification.id}">
            <strong>${notification.title || 'Notification'}</strong>
            <span>${notification.message || ''}</span>
          </button>
        `).join('') : '<div class="empty-state">No new notifications.</div>'}
      </div>
    `;
    document.body.appendChild(dropdown);
    notificationButton.setAttribute('aria-expanded', 'true');

    document.getElementById('markAllNotifications')?.addEventListener('click', async () => {
      await markAllNotificationsAsRead(user.uid);
      await renderTopbar();
    });

    dropdown.querySelectorAll('[data-notification-id]').forEach((item) => {
      item.addEventListener('click', async () => {
        await markNotificationAsRead(item.dataset.notificationId);
        item.classList.remove('unread');
        notifications = notifications.map((notification) => notification.id === item.dataset.notificationId
          ? { ...notification, isRead: true }
          : notification);
        await renderTopbar();
      });
    });
  });

  const profileMenuToggle = document.getElementById('profileMenuToggle');
  profileMenuToggle?.addEventListener('click', () => {
    const existing = document.getElementById('profileDropdown');
    if (existing) existing.remove();

    const dropdown = document.createElement('div');
    dropdown.id = 'profileDropdown';
    dropdown.className = 'panel';
    dropdown.style.position = 'absolute';
    dropdown.style.right = '24px';
    dropdown.style.top = '76px';
    dropdown.style.width = '220px';
    dropdown.style.zIndex = '20';
    dropdown.innerHTML = `
      <div class="profile-chip" style="margin-bottom: 12px;">
        <div class="avatar">${getInitials(displayName)}</div>
        <div>
          <div><strong>${displayName}</strong></div>
          <small>${role}</small>
        </div>
      </div>
      <a href="./profile.html" class="nav-item" style="color: var(--text-primary); background: #f8fafc;">👤 My Profile</a>
      <a href="./settings.html" class="nav-item" style="color: var(--text-primary); background: #f8fafc;">⚙️ Settings</a>
      <button class="nav-item" id="logoutButton" style="color: var(--text-primary); background: #f8fafc; width: 100%; text-align: left;">🚪 Logout</button>
    `;
    document.body.appendChild(dropdown);

    document.getElementById('logoutButton')?.addEventListener('click', async () => {
      await signOutUser();
      window.location.href = './login.html';
    });
  });

  const sidebarToggle = document.getElementById('sidebarToggle');
  sidebarToggle?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.display = sidebar.style.display === 'none' ? 'block' : 'none';
  });
}

onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = './login.html';
    return;
  }
  renderTopbar().catch((error) => console.error('Unable to render topbar:', error));
});
