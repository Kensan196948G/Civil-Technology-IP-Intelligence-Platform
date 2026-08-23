'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { TAG_CLASS, type DetailSpec } from './types';

type Ctx = { open: (spec: DetailSpec) => void; close: () => void };

const DetailContext = createContext<Ctx | null>(null);

export function useDetail(): Ctx {
  const ctx = useContext(DetailContext);
  // Providerの外で使われた場合でも画面を壊さない（何もしないダミーを返す）。
  return ctx ?? { open: () => {}, close: () => {} };
}

export function DetailProvider({ children }: { children: ReactNode }) {
  const [spec, setSpec] = useState<DetailSpec | null>(null);

  const open = useCallback((next: DetailSpec) => setSpec(next), []);
  const close = useCallback(() => setSpec(null), []);

  // Escでも閉じられるようにする（オーバーレイのクリックだけだとキーボード操作で閉じられない）。
  useEffect(() => {
    if (!spec) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSpec(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spec]);

  return (
    <DetailContext.Provider value={{ open, close }}>
      {children}
      {spec && <Drawer spec={spec} onClose={close} />}
    </DetailContext.Provider>
  );
}

function Drawer({ spec, onClose }: { spec: DetailSpec; onClose: () => void }) {
  const tagClass = TAG_CLASS[spec.tone ?? 'gray'];

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.32)', zIndex: 50, cursor: 'pointer' }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={spec.title}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 470, maxWidth: '100vw', background: '#fff',
          zIndex: 51, boxShadow: '-8px 0 30px rgba(16,24,40,.14)', display: 'flex', flexDirection: 'column'
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {spec.tag && <span className={`badge ${tagClass}`} style={{ flex: 'none', marginTop: 2 }}>{spec.tag}</span>}
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6, flex: 1 }}>{spec.title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            style={{
              border: 'none', background: 'var(--chip)', color: 'var(--ink-2)', width: 28, height: 28,
              borderRadius: 7, fontSize: 13, flex: 'none', fontFamily: 'inherit'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {spec.meta && spec.meta.length > 0 && (
            <dl className="kv">
              {spec.meta.map((m, i) => (
                <div key={i} style={{ display: 'contents' }}>
                  <dt>{m.k}</dt>
                  <dd>{m.v}</dd>
                </div>
              ))}
            </dl>
          )}

          {spec.body && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.9, color: 'var(--ink)' }}>{spec.body}</p>}

          {spec.form && spec.form.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {spec.form.map((f, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label htmlFor={`detail-field-${i}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
                    {f.label}
                  </label>
                  {f.textarea
                    ? <textarea id={`detail-field-${i}`} className="textarea" placeholder={f.placeholder} />
                    : <input id={`detail-field-${i}`} className="input" placeholder={f.placeholder} />}
                </div>
              ))}
            </div>
          )}

          {spec.citations && spec.citations.length > 0 && (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>出どころ</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {spec.citations.map((c, i) => (
                  <span key={i} className="mono" style={{ background: 'var(--chip)', color: 'var(--ink-2)', borderRadius: 5, padding: '3px 8px', fontSize: 11 }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {spec.note && <div className="notice notice-amber">{spec.note}</div>}
        </div>

        {spec.actions && spec.actions.length > 0 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line-2)', display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {spec.actions.map((a, i) => {
              const cls = `btn ${a.primary ? 'btn-primary' : a.href ? 'btn-secondary' : 'btn-ghost'}`;
              return a.href
                ? <Link key={i} href={a.href} className={cls} onClick={onClose}>{a.label}</Link>
                : <button key={i} type="button" className={cls} onClick={onClose}>{a.label}</button>;
            })}
          </div>
        )}
      </aside>
    </>
  );
}
