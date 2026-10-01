import { getCurrentUser, onAuthStateChanged } from '../auth/auth.js';
import { getCurrentUserProfile } from '../services/user-service.js';

onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = './login.html';
    return;
  }

  try {
    const profile = await getCurrentUserProfile(user.uid);
    if (profile?.role !== 'OWNER') {
      window.location.href = './dashboard.html';
    }
  } catch (error) {
    console.error('Settings access check failed:', error);
  }
});
