import 'server-only';
import { initializeApp, getApps, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

// On Cloud Run: the service's own service account (ADC).
// Locally: `gcloud auth application-default login`, or the Firebase Emulator
// (when FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST are set, the Admin SDK connects to it automatically).
function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  return initializeApp({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    ...(usingEmulator ? {} : { credential: applicationDefault() }),
  });
}

let db: Firestore | null = null;
export function adminDb(): Firestore {
  if (!db) {
    db = getFirestore(app());
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}

export function adminAuth(): Auth {
  return getAuth(app());
}
