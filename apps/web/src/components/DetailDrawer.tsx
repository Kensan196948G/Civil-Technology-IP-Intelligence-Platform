'use client';
import Link from 'next/link';
import { Kv } from './ui';
import type { RowDetail } from './demo';

/** デザインBの右側ドロワー（詳細表示）。 */

export function DetailDrawer({ detail, onClose }: { detail: RowDetail; onClose: () => void }) {
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden />
      <div className="drawer" role="dialog" aria-label={detail.tag ?? '詳細'}>
        <div className="drawer-head">
          {detail.tag && <span className="tag" style={{ color: detail.tagFg ?? '#5A6678', background: detail.tagBg ?? '#F2F4F8', marginTop: 2 }}>{detail.tag}</span>}
          <div className="drawer-title">{detail.title ?? '詳細'}</div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className="drawer-body">
          {detail.meta && detail.meta.length > 0 && <Kv items={detail.meta} />}
          {detail.body && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.9 }}>{detail.body}</p>}
          {detail.citations && detail.citations.length > 0 && (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>出どころ</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {detail.citations.map(c => (
                  <span key={c} className="mono" style={{ background: 'var(--sunk)', color: 'var(--ink-2)', borderRadius: 5, padding: '3px 8px', fontSize: 11 }}>{c}</span>
                ))}
              </div>
            </div>
          )}
          {detail.note && <div className="note">{detail.note}</div>}
        </div>
        {detail.actions && detail.actions.length > 0 && (
          <div className="drawer-foot">
            {detail.actions.map(a => {
              const style: React.CSSProperties = a.primary
                ? { background: '#E08A2B', color: '#fff', border: '1px solid #E08A2B' }
                : a.href
                  ? { background: '#fff', color: '#2E5AAC', border: '1px solid #C9D7EC' }
                  : { background: '#fff', color: '#5A6678', border: '1px solid #E3E8EF' };
              const inner = <span className="btn" style={style}>{a.label}</span>;
              return a.href
                ? <Link key={a.label} href={a.href} onClick={onClose}>{inner}</Link>
                : <button key={a.label} type="button" onClick={onClose} style={{ padding: 0, border: 'none', background: 'transparent', fontFamily: 'inherit' }}>{inner}</button>;
            })}
          </div>
        )}
      </div>
    </>
  );
}
