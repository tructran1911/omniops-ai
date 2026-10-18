import { GoogleAuthProvider, signInAnonymously, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Role } from '@/types/domain';

export const homeOf = (role: Role | null | undefined) => (role === 'manager' ? '/manager' : '/staff');

/** Google sign-in; the first time, a profile with the Staff role is created. */
export async function signInGoogle(): Promise<Role> {
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.get('role') as Role;
  await setDoc(ref, { role: 'staff', displayName: user.displayName ?? user.email ?? 'Staff user', isDemo: false });
  return 'staff';
}

const DEMO_NAMES: Record<Role, string> = { staff: 'Demo user (Staff)', manager: 'Demo user (Manager)' };

/** Demo mode: anonymous sign-in plus a chosen role. */
export async function signInDemo(role: Role): Promise<void> {
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
  await setDoc(doc(db, 'users', user.uid), { role, displayName: DEMO_NAMES[role], isDemo: true }, { merge: true });
}

/** Switch role (demo accounts only). */
export async function switchRole(role: Role): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  await updateDoc(doc(db, 'users', user.uid), { role, displayName: DEMO_NAMES[role] });
}

export const signOut = () => fbSignOut(auth);
