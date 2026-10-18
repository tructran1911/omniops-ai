'use client';

import { RequireRole } from '@/components/RequireRole';
import { UploadForm } from '@/components/UploadForm';

export default function NewPackagePage() {
  return (
    <RequireRole role="staff">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold">New document package</h1>
          <p className="text-sm text-zinc-500">
            OmniOps AI reads the three documents with Gemini, cross-checks them, applies your policy rules and scores the risk (usually under a minute).
          </p>
        </div>
        <UploadForm />
      </div>
    </RequireRole>
  );
}
