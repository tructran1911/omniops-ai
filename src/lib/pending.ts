'use client';

import { useSyncExternalStore } from 'react';
import { api } from './api-client';

// The create/resubmit API calls stay open until the pipeline finishes (~10–60 s). The UI navigates away immediately,
// so any error is parked here for the detail page to display.
const errors = new Map<string, string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function startRequest(pkgId: string, path: string, init: RequestInit) {
  errors.delete(pkgId);
  emit();
  api(path, init).catch((e: Error) => {
    errors.set(pkgId, e.message);
    emit();
  });
}

export function usePendingError(pkgId: string): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => errors.get(pkgId) ?? null,
    () => null,
  );
}
