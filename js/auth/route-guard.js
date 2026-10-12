import { onAuthStateChanged, signOutUser } from './auth.js';
import { getCurrentUserProfile } from '../services/user-service.js';
import { showAppLoader, hideAppLoader, initCoordinator } from '../utils/helpers.js';

export function initializeRouteGuard({ allowedRoles = [], redirectTo = './login.html' } = {}) {
  initCoordinator.register('routeGuard', { required: true, description: 'Account access verification' });
  showAppLoader('Verifying account access...');

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(async (user) => {
      if (!user) {
        initCoordinator.cancelAll();
        hideAppLoader(true);
        window.location.href = redirectTo;
        resolve(null);
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
          initCoordinator.cancelAll();
          hideAppLoader(true);
          window.location.href = redirectTo;
          resolve(null);
          return;
        }

        const role = profile?.role || null;

        if (allowedRoles.length && !allowedRoles.includes(role)) {
          console.warn(`Access denied: Role ${role} is not permitted for this route.`);
          initCoordinator.cancelAll();
          hideAppLoader(true);
          window.location.href = './dashboard.html';
          resolve(null);
          return;
        }

        initCoordinator.complete('routeGuard');
        resolve({ user, profile, role });
      } catch (err) {
        // Fail closed: deny access on any error
        console.error('Route guard error (failing closed):', err);
        initCoordinator.cancelAll();
        hideAppLoader(true);
        window.location.href = redirectTo;
        resolve(null);
      } finally {
        unsubscribe();
      }
    });
  });
}
