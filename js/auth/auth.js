import { getFirebaseServices } from '../firebase/firebase-config.js';
import { clearUserProfileCache } from '../services/user-service.js';

function getAuth() {
  return getFirebaseServices().auth;
}

function getDb() {
  return getFirebaseServices().db;
}

export function getCurrentUser() {
  return getAuth()?.currentUser || null;
}

export async function signInWithEmail(email, password) {
  const auth = getAuth();
  if (!auth) {
    throw new Error('Firebase is not configured yet. Update js/firebase/firebase-config.js with your project settings.');
  }
  return auth.signInWithEmailAndPassword(email, password);
}

export async function signInWithGoogle() {
  const auth = getAuth();
  if (!auth) {
    throw new Error('Firebase is not configured yet. Update js/firebase/firebase-config.js with your project settings.');
  }

  const provider = new window.firebase.auth.GoogleAuthProvider();
  const result = await auth.signInWithPopup(provider);
  await ensureUserProfile(result.user);
  return result.user;
}

async function ensureUserProfile(user) {
  const db = getDb();
  if (!db || !user) return;

  const profileRef = db.collection('users').doc(user.uid);
  const profile = await profileRef.get();

  if (!profile.exists) {
    await profileRef.set({
      uid: user.uid,
      fullName: user.displayName || user.email?.split('@')[0] || 'Employee',
      email: user.email || '',
      role: 'EMPLOYEE',
      avatarUrl: user.photoURL || '',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
}

export async function signOutUser() {
  clearUserProfileCache();
  return getAuth()?.signOut();
}

export function onAuthStateChanged(callback) {
  const auth = getAuth();
  if (!auth) {
    // If not initialized yet, wait for DOMContentLoaded / defer scripts
    if (document.readyState === 'loading') {
      let unsubscribe = () => {};
      window.addEventListener('DOMContentLoaded', () => {
        const deferredAuth = getAuth();
        if (deferredAuth) unsubscribe = deferredAuth.onAuthStateChanged(callback);
      }, { once: true });
      return () => unsubscribe();
    }
    return () => {};
  }
  return auth.onAuthStateChanged(callback);
}

export function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = './login.html';
    return false;
  }
  return true;
}
