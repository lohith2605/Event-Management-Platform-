import admin from 'firebase-admin';
import { cert, getApps } from 'firebase-admin/app';

/**
 * Singleton Firebase Admin SDK initializer
 * Reads project credentials securely from backend environment variables.
 */
export const initializeFirebaseAdmin = () => {
  if (getApps().length > 0) {
    return admin;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('⚠️ [Firebase Admin] Credentials are not fully configured in backend/.env');
    return null;
  }

  try {
    // Handle both literal multi-line keys and escaped \n sequences
    const formattedPrivateKey = privateKey.includes('\\n')
      ? privateKey.replace(/\\n/g, '\n')
      : privateKey;

    admin.initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: formattedPrivateKey,
      }),
    });

    console.log('✅ [Firebase Admin] Initialized successfully.');
    return admin;
  } catch (error) {
    console.error('❌ [Firebase Admin] Initialization failure:', error.message);
    return null;
  }
};

export { admin };
export default admin;
