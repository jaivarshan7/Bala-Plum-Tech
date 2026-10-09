import { onAuthStateChanged, signOutUser } from './auth.js';
import { getCurrentUserProfile } from '../services/user-service.js';
import { showAppLoader, hideAppLoader } from '../utils/helpers.js';

export function initializeRouteGuard({ allowedRoles = [], redirectTo = './login.html' } = {}) {
  return new Promise((resolve) => {
    showAppLoader('Verifying account access...');

    const unsubscribe = onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = redirectTo;
        resolve(false);
        return;
      }

      try {
        const profile = await getCurrentUserProfile(user.uid);

        // Account must have an active profile
        if (!profile || profile.active === false) {
          console.warn('Access denied: User account is inactive or profile does not exist.');
          try {
            await signOutUser();
          } catch (signErr) {
            console.error('Error signing out inactive user:', signErr);
          }
          window.location.href = redirectTo;
          resolve(false);
          return;
        }

        const role = profile?.role || null;

        if (allowedRoles.length && !allowedRoles.includes(role)) {
          window.location.href = './dashboard.html';
          resolve(false);
          return;
        }

        hideAppLoader();
        resolve(true);
      } catch (err) {
        // Fail closed: deny access on any error
        console.error('Route guard error (failing closed):', err);
        window.location.href = redirectTo;
        resolve(false);
      } finally {
        unsubscribe();
      }
    });
  });
}
