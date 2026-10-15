import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/**
 * Firebase Web Client Configuration
 * Safely loads client credentials from Vite environment variables.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if credentials are valid and present
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'your_api_key' &&
  !firebaseConfig.apiKey.includes('your_') &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'your_project_id'
);

let auth = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    console.log('🔥 [Firebase Client] Initialized with authDomain:', firebaseConfig.authDomain);
  } catch (error) {
    console.warn('⚠️ [Firebase] Client initialization failed:', error.message);
  }
}

export { auth };
export default auth;
