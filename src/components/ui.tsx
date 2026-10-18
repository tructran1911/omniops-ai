'use client';

import type { ReactNode } from 'react';
import type { PackageStatus, RiskLevel, Severity, TimestampLike } from '@/types/domain';

export const STATUS_LABELS: Record<PackageStatus, string> = {
  analyzing: 'Analyzing',
  pending_review: 'Pending review',
  needs_fix: 'Needs fix',
  approved: 'Approved',
  rejected: 'Rejected',
  error: 'Analysis failed',
};

const STATUS_STYLES: Record<PackageStatus, string> = {
  analyzing: 'bg-sky-100 text-sky-800',
  pending_review: 'bg-amber-100 text-amber-800',
  needs_fix: 'bg-orange-100 text-orange-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-zinc-200 text-zinc-700',
  error: 'bg-red-100 text-red-800',
};

export const RISK_LABELS: Record<RiskLevel, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

const RISK_STYLES: Record<RiskLevel, string> = {
  low: 'bg-emerald-600',
  medium: 'bg-amber-500',
  high: 'bg-orange-600',
  critical: 'bg-red-700',
};

export const SEVERITY_LABELS: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: 'border-red-300 bg-red-50 text-red-800',
  high: 'border-orange-300 bg-orange-50 text-orange-800',
  medium: 'border-amber-300 bg-amber-50 text-amber-800',
  low: 'border-zinc-300 bg-zinc-50 text-zinc-700',
};

export function StatusBadge({ status }: { status: PackageStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status === 'analyzing' && <Spinner className="h-3 w-3" />}
      {STATUS_LABELS[status]}
    </span>
  );
}

export function RiskBadge({ score, level, size = 'sm' }: { score?: number; level?: RiskLevel; size?: 'sm' | 'lg' }) {
  if (score === undefined || !level) return <span className="text-xs text-zinc-400">—</span>;
  if (size === 'lg') {
    return (
      <div className={`flex flex-col items-center justify-center rounded-2xl px-6 py-4 text-white ${RISK_STYLES[level]}`}>
        <span className="text-5xl font-bold tabular-nums">{score}</span>
        <span className="text-sm opacity-90">/100 · {RISK_LABELS[level]} risk</span>
      </div>
    );
  }
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold text-white tabular-nums ${RISK_STYLES[level]}`}>
      {score} · {RISK_LABELS[level]}
    </span>
  );
}

export function SeverityTag({ severity }: { severity: Severity }) {
  return <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[severity]}`}>{SEVERITY_LABELS[severity]}</span>;
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-zinc-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function Button({
  children, onClick, disabled, variant = 'primary', type = 'button', className = '',
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger' | 'success'; className?: string;
}) {
  const styles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>;
}

export function formatTime(t?: TimestampLike | null) {
  if (!t) return '';
  return t.toDate().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

export const millisOf = (t?: TimestampLike | null) => (t ? t.toMillis() : Date.now());
