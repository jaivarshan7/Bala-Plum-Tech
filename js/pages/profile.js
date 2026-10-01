import { getCurrentUser, onAuthStateChanged } from '../auth/auth.js';
import { getCurrentUserProfile } from '../services/user-service.js';
import { getInitials } from '../utils/helpers.js';

function renderProfileSkeletons() {
  const profileCard = document.getElementById('profileCard');
  if (!profileCard) return;
  profileCard.innerHTML = `
    <div class="profile-details">
      <div class="skeleton" style="width: 126px; height: 126px; border-radius: 50%; margin: 0 auto 8px;"></div>
    </div>
    <div class="meta">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
  `;
}

async function loadProfile() {
  const user = getCurrentUser();
  if (!user) return;

  const profileCard = document.getElementById('profileCard');
  if (!profileCard) return;

  renderProfileSkeletons();

  try {
    const profile = await getCurrentUserProfile(user.uid);
    const displayName = profile?.fullName || user.displayName || 'User';
    const role = profile?.role || 'EMPLOYEE';

    profileCard.innerHTML = `
      <div class="profile-details">
        <div class="profile-avatar-large">${getInitials(displayName)}</div>
        <div class="small-muted">Profile details are stored securely in Firestore.</div>
      </div>
      <div class="meta">
        <div class="info-block">
          <div>
            <label class="small-muted">Full Name</label>
            <div><strong>${displayName}</strong></div>
          </div>
          <div>
            <label class="small-muted">Email</label>
            <div><strong>${user.email}</strong></div>
          </div>
          <div>
            <label class="small-muted">Role</label>
            <div><span class="value-tag">${role}</span></div>
          </div>
          <div>
            <label class="small-muted">Status</label>
            <div><span class="value-tag">${profile?.active === false ? 'Inactive' : 'Active'}</span></div>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Unable to load profile:', error);
    profileCard.innerHTML = `
      <div class="empty-state">
        <p>Unable to load profile. Please check your connection.</p>
        <button id="retryProfileBtn" class="btn btn-secondary" style="margin-top: 8px;">Try Again</button>
      </div>
    `;
    document.getElementById('retryProfileBtn')?.addEventListener('click', loadProfile);
  }
}

onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = './login.html';
    return;
  }
  loadProfile();
});
