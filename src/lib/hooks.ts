'use client';

import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where, type Query } from 'firebase/firestore';
import { db } from './firebase';
import type { ApprovalDoc, AuditEntry, Finding, PackageDoc, PolicyRule } from '@/types/domain';

export type WithId<T> = T & { id: string };

type Live<T> = { data: T; loading: boolean; error: string | null };

function useLiveQuery<T>(make: () => Query | null, deps: unknown[], sort?: (a: WithId<T>, b: WithId<T>) => number): Live<WithId<T>[]> {
  const [state, setState] = useState<Live<WithId<T>[]>>({ data: [], loading: true, error: null });
  useEffect(() => {
    const q = make();
    if (!q) return;
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
        setState({ data: sort ? rows.sort(sort) : rows, loading: false, error: null });
      },
      (err) => setState({ data: [], loading: false, error: err.message }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

const byUpdatedDesc = (a: WithId<PackageDoc>, b: WithId<PackageDoc>) =>
  (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0);

/** My packages (sorted on the client so no composite index is needed). */
export const useMyPackages = (uid: string | undefined) =>
  useLiveQuery<PackageDoc>(() => (uid ? query(collection(db, 'packages'), where('ownerUid', '==', uid)) : null), [uid], byUpdatedDesc);

/** Every package (Firestore Rules only let a manager read this). */
export const useAllPackages = (enabled: boolean) =>
  useLiveQuery<PackageDoc>(() => (enabled ? query(collection(db, 'packages'), orderBy('updatedAt', 'desc'), limit(100)) : null), [enabled]);

export const useFindings = (pkgId: string, version: number | undefined) =>
  useLiveQuery<Finding>(
    () => (version ? query(collection(db, 'packages', pkgId, 'findings'), where('version', '==', version)) : null),
    [pkgId, version],
    (a, b) => a.id.localeCompare(b.id),
  );

export const useApprovals = (pkgId: string) =>
  useLiveQuery<ApprovalDoc>(() => query(collection(db, 'packages', pkgId, 'approvals'), orderBy('at', 'asc')), [pkgId]);

export const usePolicies = () =>
  useLiveQuery<PolicyRule>(() => collection(db, 'policy_rules'), [], (a, b) => a.id.localeCompare(b.id));

export const useAuditLog = (enabled: boolean) =>
  useLiveQuery<AuditEntry>(() => (enabled ? query(collection(db, 'audit_log'), orderBy('at', 'desc'), limit(100)) : null), [enabled]);

export function usePackage(pkgId: string): Live<WithId<PackageDoc> | null> {
  const [state, setState] = useState<Live<WithId<PackageDoc> | null>>({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = onSnapshot(
      doc(db, 'packages', pkgId),
      (snap) => setState({ data: snap.exists() ? { ...(snap.data() as PackageDoc), id: snap.id } : null, loading: !snap.exists(), error: null }),
      // A package just created from this screen may not exist yet → Rules reject the read. Retry every second (~30 times).
      (err) => {
        if (attempt < 30) timer = setTimeout(() => setAttempt((a) => a + 1), 1000);
        else setState({ data: null, loading: false, error: err.message });
      },
    );
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [pkgId, attempt]);
  return state;
}

/** Stopwatch: seconds elapsed from start to stop (or to now). */
export function useElapsed(start: number | undefined, stop: number | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!start || stop) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [start, stop]);
  if (!start) return 0;
  return Math.max(0, ((stop ?? now) - start) / 1000);
}
