import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Vite environment variables loading standard
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if config has been set with valid keys (and not the example placeholders)
const isConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== '' && 
  !firebaseConfig.apiKey.startsWith('AIzaSyA1');

let app;
let auth;
let db;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('⚡ Firebase Cloud Authentication successfully initialized.');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase SDK:', error);
  }
} else {
  console.warn(
    '⚠️ Firebase API keys not detected in .env file.\n' +
    'Entering high-fidelity Developer Simulation Mode. All signups, logins, sessions, and database changes will run locally using LocalStorage.'
  );
}

export { app, auth, db, isConfigured };
