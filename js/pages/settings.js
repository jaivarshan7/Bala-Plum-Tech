import { initializeRouteGuard } from '../auth/route-guard.js';

initializeRouteGuard({ allowedRoles: ['OWNER'] })
  .catch((error) => {
    console.error('Settings access check failed:', error);
  });
