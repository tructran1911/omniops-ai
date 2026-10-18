'use client';

import { useState } from 'react';
import { RequireRole } from '@/components/RequireRole';
import { Button, Card, ErrorNote, Spinner, SEVERITY_LABELS } from '@/components/ui';
import { usePolicies } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { FIELD_LABELS } from '@/lib/pipeline/policy';
import type { PolicyRule } from '@/types/domain';

function Policies() {
  const { data, loading, error } = usePolicies();
  const [edits, setEdits] = useState<Record<string, Partial<PolicyRule>>>({});
  const rules: PolicyRule[] = data.map(({ id, ...r }) => ({ ...r, id, ...edits[id] }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const update = (id: string, patch: Partial<PolicyRule>) => setEdits((m) => ({ ...m, [id]: { ...m[id], ...patch } }));

  const save = async () => {
    setBusy(true);
    setMessage(null);
    setSaveError(null);
    try {
      const res = await api<{ changes: string[] }>('/api/policies', { method: 'PUT', body: JSON.stringify({ rules }) });
      setEdits({});
      setMessage(res.changes.length ? `Saved: ${res.changes.join('; ')}` : 'Saved (no value changed)');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Company policy rules</h1>
        <p className="text-sm text-zinc-500">Thresholds you own — no developer needed. Changes apply to every later analysis and are written to the audit log.</p>
      </div>
      <ErrorNote message={error} />
      {loading ? (
        <p className="flex items-center gap-2 text-zinc-500"><Spinner /> Loading…</p>
      ) : rules.length === 0 ? (
        <Card><p className="text-sm text-zinc-600">No policy rules in Firestore yet — the built-in defaults are in use. Run <code>npm run seed</code> to create them.</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-4 py-2">ID</th><th className="px-4 py-2">Rule</th><th className="px-4 py-2">Applies to</th>
                <th className="px-4 py-2">Threshold</th><th className="px-4 py-2">Severity</th><th className="px-4 py-2">On</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2 font-mono text-xs">{r.id}</td>
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-zinc-500">{FIELD_LABELS[r.field] ?? r.field}</td>
                  <td className="px-4 py-2">
                    <span className="mr-1 text-zinc-500">{r.operator === 'lte' ? '≤' : '≥'}</span>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={r.value}
                      onChange={(e) => update(r.id, { value: Number(e.target.value) })}
                      className="w-24 rounded border border-zinc-300 px-2 py-1"
                    />
                    <span className="ml-1 text-zinc-500">{r.unit}</span>
                  </td>
                  <td className="px-4 py-2">{r.id === 'TOL' ? '—' : `${SEVERITY_LABELS[r.severity]} · ${r.points} pts`}</td>
                  <td className="px-4 py-2">
                    <input type="checkbox" checked={r.enabled} onChange={(e) => update(r.id, { enabled: e.target.checked })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      <ErrorNote message={saveError} />
      {rules.length > 0 && (
        <div className="flex justify-end"><Button onClick={save} disabled={busy}>{busy && <Spinner />} Save changes</Button></div>
      )}
    </div>
  );
}

export default function PoliciesPage() {
  return <RequireRole role="manager"><Policies /></RequireRole>;
}
