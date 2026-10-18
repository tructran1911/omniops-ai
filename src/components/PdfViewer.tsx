'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchFileUrl } from '@/lib/api-client';
import { DOC_LABELS, type DocType } from '@/types/domain';
import { Spinner } from './ui';

export interface ViewerTarget { docType: DocType; page?: number }

/** Package document viewer: authenticated fetch → blob URL → iframe jumps to the cited page. */
export function PdfViewer({ pkgId, version, available, target, onChange }: {
  pkgId: string;
  version: number;
  available: DocType[];
  target: ViewerTarget;
  onChange: (t: ViewerTarget) => void;
}) {
  const [urls, setUrls] = useState<Partial<Record<string, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const key = `${version}:${target.docType}`;
  const url = urls[key];
  const error = errors[key] ?? null;

  useEffect(() => {
    if (url) return;
    let cancelled = false;
    fetchFileUrl(`/api/files/${pkgId}/${target.docType}`)
      .then((u) => !cancelled && setUrls((m) => ({ ...m, [key]: u })))
      .catch((e) => !cancelled && setErrors((m) => ({ ...m, [key]: e.message })));
    return () => {
      cancelled = true;
    };
  }, [pkgId, key, target.docType, url]);

  // Release the blob URLs when leaving the page
  const urlsRef = useRef(urls);
  useEffect(() => {
    urlsRef.current = urls;
  }, [urls]);
  useEffect(() => () => Object.values(urlsRef.current).forEach((u) => u && URL.revokeObjectURL(u)), []);

  const isXml = target.docType === 'invoiceXml';
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="flex gap-1 border-b border-zinc-200 bg-zinc-50 p-1.5">
        {available.map((t) => (
          <button
            key={t}
            onClick={() => onChange({ docType: t })}
            className={`rounded-md px-3 py-1.5 text-sm ${t === target.docType ? 'bg-white font-medium shadow-sm' : 'text-zinc-600 hover:bg-white'}`}
          >
            {DOC_LABELS[t]}
          </button>
        ))}
        {target.page && <span className="ml-auto self-center pr-2 text-xs text-zinc-500">Page {target.page}</span>}
      </div>
      <div className="relative min-h-[560px] flex-1">
        {error && <p className="p-4 text-sm text-red-700">{error}</p>}
        {!error && !url && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-zinc-500"><Spinner /> Loading document…</div>
        )}
        {url && (
          <iframe
            key={`${key}:${target.page ?? 1}`}
            src={isXml ? url : `${url}#page=${target.page ?? 1}&view=FitH`}
            className="absolute inset-0 h-full w-full"
            title={DOC_LABELS[target.docType]}
          />
        )}
      </div>
    </div>
  );
}
