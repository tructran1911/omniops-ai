// Write the default policy rules (P1–P3 + the TOL tolerance) into Firestore. Safe to re-run.
// Real project:  npm run seed        (needs .env.local + gcloud auth application-default login)
// Emulator:      npm run seed:local  (needs npm run emulators running)
import { adminDb } from '@/lib/firebase-admin';
import { DEFAULT_RULES } from '@/lib/pipeline/policy';

async function main() {
  const db = adminDb();
  const batch = db.batch();
  for (const { id, ...rule } of DEFAULT_RULES) batch.set(db.doc(`policy_rules/${id}`), rule);
  await batch.commit();
  console.log(`Wrote ${DEFAULT_RULES.length} policy rules to project ${process.env.GOOGLE_CLOUD_PROJECT}` +
    (process.env.FIRESTORE_EMULATOR_HOST ? ' (emulator)' : ''));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
