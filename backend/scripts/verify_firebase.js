import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Read frontend .env directly
const frontendEnvContent = fs.readFileSync(path.resolve(__dirname, '../../frontend/.env'), 'utf-8');
const frontendEnv = {};
frontendEnvContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      frontendEnv[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
    }
  }
});

import { initializeFirebaseAdmin } from '../src/config/firebaseAdmin.js';
import * as firebaseAuth from 'firebase-admin/auth';

console.log('--- Checking Firebase Configuration ---\n');

console.log('Frontend Env Firebase values:');
console.log('  VITE_FIREBASE_PROJECT_ID:', frontendEnv['VITE_FIREBASE_PROJECT_ID']);
console.log('  VITE_FIREBASE_AUTH_DOMAIN:', frontendEnv['VITE_FIREBASE_AUTH_DOMAIN']);
console.log('  VITE_FIREBASE_API_KEY:', frontendEnv['VITE_FIREBASE_API_KEY'] ? frontendEnv['VITE_FIREBASE_API_KEY'].substring(0, 10) + '...' : 'MISSING');
console.log('  VITE_FIREBASE_STORAGE_BUCKET:', frontendEnv['VITE_FIREBASE_STORAGE_BUCKET']);
console.log('  VITE_FIREBASE_APP_ID:', frontendEnv['VITE_FIREBASE_APP_ID']);

console.log('\nBackend Env Firebase values:');
console.log('  FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID);
console.log('  FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL);
console.log('  FIREBASE_PRIVATE_KEY present:', Boolean(process.env.FIREBASE_PRIVATE_KEY));

async function runTests() {
  console.log('\n[1] Testing Frontend Firebase Web API Key with Google Identity Toolkit REST API...');
  const apiKey = frontendEnv['VITE_FIREBASE_API_KEY'];
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        continueUri: `https://${frontendEnv['VITE_FIREBASE_AUTH_DOMAIN']}`,
        providerId: 'google.com'
      })
    });
    const data = await res.json();
    if (res.ok) {
      console.log('  ✅ Frontend Web API Key is VALID and connected to Firebase Identity Toolkit!');
      console.log('  Auth URI Provider:', data.providerId || 'google.com');
    } else {
      console.log('  ⚠️ Frontend Web API Key response:', res.status, data.error?.message || data);
    }
  } catch (err) {
    console.error('  ❌ Error testing Frontend Web API Key:', err.message);
  }

  console.log('\n[2] Testing Backend Firebase Admin SDK initialization and live connectivity...');
  try {
    const adminApp = initializeFirebaseAdmin();
    if (!adminApp) {
      throw new Error('initializeFirebaseAdmin returned null. Check backend/.env variables.');
    }
    const auth = firebaseAuth.getAuth();
    console.log('  - Attempting to list users or verify credentials with Google...');
    const listResult = await auth.listUsers(1);
    console.log(`  ✅ Backend Firebase Admin connected successfully to project: "${process.env.FIREBASE_PROJECT_ID}"!`);
    console.log(`  Total users in project (first batch): ${listResult.users.length}`);
    if (listResult.users.length > 0) {
      console.log(`  Sample user email: ${listResult.users[0].email || 'No email'}`);
    }
  } catch (err) {
    console.error('  ❌ Firebase Admin test failed:', err.message);
    if (err.code) console.error('  Error code:', err.code);
  }
}

runTests();
