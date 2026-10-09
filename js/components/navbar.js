import { getCurrentUser, onAuthStateChanged, signOutUser } from '../auth/auth.js';
import { getFirebaseServices } from '../firebase/firebase-config.js';
import { getInitials } from '../utils/helpers.js';
import { getNotificationsForUser, markAllNotificationsAsRead, markNotificationAsRead } from '../services/notification-service.js';
import { getCurrentUserProfile, clearUserProfileCache } from '../services/user-service.js';

const { db } = getFirebaseServices();

let activeNotifications = [];

export async function renderTopbar() {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;

  const user = getCurrentUser();

  if (!user) {
    topbar.innerHTML = '';
    return;
  }

  let displayName = user.displayName || 'User';
  let role = 'EMPLOYEE';

  try {
    const profile = await getCurrentUserProfile(user.uid);
    if (profile) {
      displayName = profile.fullName || displayName;
      role = profile.role || role;
    }
  } catch (err) {
    console.error('Unable to fetch user profile for topbar:', err);
  }

  try {
    activeNotifications = await getNotificationsForUser(user.uid);
  } catch (error) {
    console.error('Unable to load notifications:', error);
    activeNotifications = [];
  }

  const unreadCount = activeNotifications.filter((notification) => !notification.isRead).length;

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

  setupTopbarListeners(user, displayName, role, unreadCount);
}

function setupTopbarListeners(user, displayName, role, unreadCount) {
  const notificationButton = document.getElementById('notificationButton');
  const profileMenuToggle = document.getElementById('profileMenuToggle');
  const sidebarToggle = document.getElementById('sidebarToggle');

  // Dismiss any open dropdowns when clicking outside
  document.addEventListener('click', (event) => {
    const target = event.target;
    const notificationDropdown = document.getElementById('notificationDropdown');
    const profileDropdown = document.getElementById('profileDropdown');

    if (notificationDropdown && !notificationDropdown.contains(target) && !notificationButton?.contains(target)) {
      notificationDropdown.remove();
      notificationButton?.setAttribute('aria-expanded', 'false');
    }

    if (profileDropdown && !profileDropdown.contains(target) && !profileMenuToggle?.contains(target)) {
      profileDropdown.remove();
    }
  });

  notificationButton?.addEventListener('click', (e) => {
    e.stopPropagation();
    const existing = document.getElementById('notificationDropdown');
    if (existing) {
      existing.remove();
      notificationButton.setAttribute('aria-expanded', 'false');
      return;
    }

    // Close profile dropdown if open
    document.getElementById('profileDropdown')?.remove();

    const dropdown = document.createElement('div');
    dropdown.id = 'notificationDropdown';
    dropdown.className = 'panel notification-dropdown';
    dropdown.innerHTML = `
      <div class="notification-header">
        <strong>Notifications</strong>
        ${unreadCount ? '<button id="markAllNotifications" class="text-button">Mark all read</button>' : ''}
      </div>
      <div class="notification-list">
        ${activeNotifications.length ? activeNotifications.map((notification) => `
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
        activeNotifications = activeNotifications.map((notification) => notification.id === item.dataset.notificationId
          ? { ...notification, isRead: true }
          : notification);
        await renderTopbar();
      });
    });
  });

  profileMenuToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    const existing = document.getElementById('profileDropdown');
    if (existing) {
      existing.remove();
      return;
    }

    // Close notification dropdown if open
    document.getElementById('notificationDropdown')?.remove();
    notificationButton?.setAttribute('aria-expanded', 'false');

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
      clearUserProfileCache();
      await signOutUser();
      window.location.href = './login.html';
    });
  });

  // Mobile sidebar toggle with overlay
  sidebarToggle?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const isVisible = sidebar.classList.contains('sidebar-open') || sidebar.style.display === 'block';

    if (isVisible) {
      sidebar.classList.remove('sidebar-open');
      sidebar.style.display = '';
      document.getElementById('sidebarBackdrop')?.remove();
    } else {
      sidebar.classList.add('sidebar-open');
      sidebar.style.display = 'block';

      // Add mobile backdrop
      let backdrop = document.getElementById('sidebarBackdrop');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'sidebarBackdrop';
        backdrop.className = 'sidebar-backdrop';
        backdrop.addEventListener('click', () => {
          sidebar.classList.remove('sidebar-open');
          sidebar.style.display = '';
          backdrop.remove();
        });
        document.body.appendChild(backdrop);
      }
    }
  });
}

onAuthStateChanged((user) => {
  if (!user) {
    if (window.location.search.includes('test=true')) return;
    window.location.href = './login.html';
    return;
  }
  renderTopbar().catch((error) => console.error('Unable to render topbar:', error));
});
