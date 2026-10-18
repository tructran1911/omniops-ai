import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

// The Firebase web config is public information (any browser can download it); data security lives in the
// Firestore Rules (firestore.rules), so it is fine to commit these values.
//
// TODO(setup): fill in the four values below (README → Setup on Google Cloud, steps 2 and 6).
//   Where: Firebase Console → ⚙️ Project settings → General → "Your apps" → the "omniops-web" web app
//   → "SDK setup and configuration" → pick "Config" → copy apiKey, authDomain, projectId, appId.
//   Example: apiKey: 'AIzaSy...', authDomain: 'omniops-ai-471203.firebaseapp.com', projectId: 'omniops-ai-471203', appId: '1:1234:web:abcd'
const firebaseConfig = {
  apiKey: 'AIzaSyDLmuN0BSQB7kI8EZZkP0ttDZzWkmmfdFI',
  authDomain: 'omniops-ai-511915.firebaseapp.com',
  projectId: 'omniops-ai-511915',
  appId: '1:408588480127:web:f96f2ee69eccafa6aed94a',
};

// Local runs against the Firebase Emulator (npm run emulators + npm run dev:local): no real project needed.
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';
const emulatorConfig = {
  apiKey: 'demo-key',
  authDomain: 'demo-omniops.firebaseapp.com',
  projectId: 'demo-omniops',
  appId: 'demo-app',
};

/** false while the TODOs above are unfilled (and no emulator is used) – the UI then shows a warning. */
export const firebaseConfigured = useEmulators || !Object.values(firebaseConfig).some((v) => v.includes('TODO'));

const app = getApps().length ? getApp() : initializeApp(useEmulators ? emulatorConfig : firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const g = globalThis as { __omniopsEmulators?: boolean };
if (useEmulators && typeof window !== 'undefined' && !g.__omniopsEmulators) {
  g.__omniopsEmulators = true;
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
