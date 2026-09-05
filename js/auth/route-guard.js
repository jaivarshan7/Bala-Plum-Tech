import { onAuthStateChanged } from './auth.js';

export function initializeRouteGuard({ allowedRoles = [], redirectTo = './login.html' } = {}) {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = redirectTo;
        resolve(false);
        return;
      }

      const userDoc = await window.db.collection('users').doc(user.uid).get();
      const role = userDoc.exists ? userDoc.data().role : null;

      if (allowedRoles.length && !allowedRoles.includes(role)) {
        window.location.href = './dashboard.html';
        resolve(false);
        return;
      }

      resolve(true);
      unsubscribe();
    });
  });
}
