import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import type { AuditEntry } from '@/types/domain';

/** Append one row to the audit log. Append-only: rows are never updated or deleted. */
export async function audit(entry: Omit<AuditEntry, 'at'>): Promise<void> {
  await adminDb().collection('audit_log').add({ ...entry, at: FieldValue.serverTimestamp() });
}
