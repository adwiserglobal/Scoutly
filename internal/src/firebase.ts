import { getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCveILbekYqwVWFIoy-fO4RA1r4Bt7CyC4',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'auth.scoutly.pro',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0931227900',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'gen-lang-client-0931227900.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '650639072481',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:650639072481:web:a8360f786908836b13eba0',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
