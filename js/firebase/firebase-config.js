const firebaseConfig = {
  apiKey: "AIzaSyCKuLPzvIxspO1-zM01us4-PZ9cuYOLpyM",
  authDomain: "bala-plum-tech.firebaseapp.com",
  projectId: "bala-plum-tech",
  messagingSenderId: "30766790556",
  appId: "1:30766790556:web:846272f0615435c4813a59",
};

const hasConfiguredFirebase = !Object.values(firebaseConfig).some((value) => typeof value === 'string' && value.includes('YOUR_'));

export function getFirebaseConfig() {
  return { ...firebaseConfig };
}

export function initializeFirebase() {
  if (!window.firebase) {
    console.warn('Firebase SDK has not loaded yet. Add your Firebase project credentials to firebase-config.js before running the app.');
    return { app: null, auth: null, db: null };
  }

  if (!hasConfiguredFirebase) {
    console.warn('Firebase client config is still using placeholder values. Update js/firebase/firebase-config.js before using the app with real data.');
    return { app: null, auth: null, db: null };
  }

  if (!window.firebase.apps.length) {
    window.firebase.initializeApp(firebaseConfig);
  }

  const firebaseApp = window.firebase.app();
  const firebaseAuth = window.firebase.auth();
  const firestore = window.firebase.firestore();
  Object.assign(window, {
    __plumbtrackApp: firebaseApp,
    __plumbtrackAuth: firebaseAuth,
    __plumbtrackDb: firestore
  });

  return {
    app: firebaseApp,
    auth: firebaseAuth,
    db: firestore
  };
}

export function getFirebaseServices() {
  if (!window.__plumbtrackApp) {
    return initializeFirebase();
  }

  return {
    app: window.__plumbtrackApp,
    auth: window.__plumbtrackAuth,
    db: window.__plumbtrackDb
  };
}

export const app = null;
export const auth = null;
export const db = null;
