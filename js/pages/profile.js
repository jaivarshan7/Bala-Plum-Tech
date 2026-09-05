import { getCurrentUser } from '../auth/auth.js';
import { getFirebaseServices } from '../firebase/firebase-config.js';
import { getCurrentUserProfile } from '../services/user-service.js';
import { getInitials } from '../utils/helpers.js';

const { db } = getFirebaseServices();

async function loadProfile() {
  const user = getCurrentUser();
  if (!user) return;

  const profile = await getCurrentUserProfile(user.uid);
  const displayName = profile?.fullName || user.displayName || 'User';
  const role = profile?.role || 'EMPLOYEE';

  const profileCard = document.getElementById('profileCard');
  if (!profileCard) return;

  profileCard.innerHTML = `
    <div class="profile-details">
      <div class="profile-avatar-large">${getInitials(displayName)}</div>
      <div class="small-muted">Profile details are stored in Firestore. File uploads are not enabled in this version.</div>
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
}

loadProfile();
