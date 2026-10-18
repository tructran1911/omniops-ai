'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Role, UserProfile } from '@/types/domain';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  role: Role | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, profile: null, role: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, profile: null, role: null, loading: true });

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubProfile?.();
      if (!user) {
        setState({ user: null, profile: null, role: null, loading: false });
        return;
      }
      setState((s) => ({ ...s, user, loading: true }));
      unsubProfile = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          const profile = snap.exists() ? (snap.data() as UserProfile) : null;
          setState({ user, profile, role: profile?.role ?? null, loading: false });
        },
        () => setState({ user, profile: null, role: null, loading: false }),
      );
    });
    return () => {
      unsubProfile?.();
      unsubAuth();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
