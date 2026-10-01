import { getFirebaseServices } from '../firebase/firebase-config.js';
import { getFirebaseConfig } from '../firebase/firebase-config.js';

const { db } = getFirebaseServices();

let cachedUserProfile = null;
let profileFetchPromise = null;

export async function getCurrentUserProfile(userId, forceRefresh = false) {
  if (!userId) return null;
  if (!forceRefresh && cachedUserProfile && (cachedUserProfile.uid === userId || cachedUserProfile.id === userId)) {
    return cachedUserProfile;
  }
  if (!forceRefresh && profileFetchPromise) {
    return profileFetchPromise;
  }

  profileFetchPromise = (async () => {
    try {
      const doc = await db.collection('users').doc(userId).get();
      if (doc.exists) {
        cachedUserProfile = { id: doc.id, ...doc.data() };
      } else {
        cachedUserProfile = null;
      }
      return cachedUserProfile;
    } finally {
      profileFetchPromise = null;
    }
  })();

  return profileFetchPromise;
}

export function clearUserProfileCache() {
  cachedUserProfile = null;
  profileFetchPromise = null;
}

export async function getAllUsers() {
  const snapshot = await db.collection('users').get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((first, second) => getTimestamp(second.createdAt) - getTimestamp(first.createdAt));
}

function getTimestamp(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  return new Date(value).getTime() || 0;
}

export async function createEmployeeAccount({ fullName, email, password, role }) {
  const primaryApp = window.__plumbtrackApp;
  const secondaryName = `employee-creator-${Date.now()}`;
  const secondaryApp = window.firebase.initializeApp(getFirebaseConfig(), secondaryName);

  try {
    const secondaryAuth = secondaryApp.auth();
    const credential = await secondaryAuth.createUserWithEmailAndPassword(email, password);

    await db.collection('users').doc(credential.user.uid).set({
      uid: credential.user.uid,
      fullName,
      email,
      role,
      avatarUrl: '',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return credential.user.uid;
  } finally {
    await secondaryApp.delete();
    if (primaryApp) window.__plumbtrackApp = primaryApp;
  }
}
