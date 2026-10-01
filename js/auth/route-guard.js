import { onAuthStateChanged } from './auth.js';
import { getCurrentUserProfile } from '../services/user-service.js';

export function initializeRouteGuard({ allowedRoles = [], redirectTo = './login.html' } = {}) {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = redirectTo;
        resolve(false);
        return;
      }

      try {
        const profile = await getCurrentUserProfile(user.uid);
        const role = profile?.role || null;

        if (allowedRoles.length && !allowedRoles.includes(role)) {
          window.location.href = './dashboard.html';
          resolve(false);
          return;
        }

        resolve(true);
      } catch (err) {
        console.error('Route guard error:', err);
        resolve(true);
      } finally {
        unsubscribe();
      }
    });
  });
}
