import { getFirebaseServices } from '../firebase/firebase-config.js';

const { auth, db } = getFirebaseServices();

export function getCurrentUser() {
  return auth?.currentUser || null;
}

export async function signInWithEmail(email, password) {
  if (!auth) {
    throw new Error('Firebase is not configured yet. Update js/firebase/firebase-config.js with your project settings.');
  }
  return auth.signInWithEmailAndPassword(email, password);
}

export async function signInWithGoogle() {
  if (!auth) {
    throw new Error('Firebase is not configured yet. Update js/firebase/firebase-config.js with your project settings.');
  }

  const provider = new window.firebase.auth.GoogleAuthProvider();
  const result = await auth.signInWithPopup(provider);
  await ensureUserProfile(result.user);
  return result.user;
}

async function ensureUserProfile(user) {
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
  return auth?.signOut();
}

export function onAuthStateChanged(callback) {
  if (!auth) {
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
