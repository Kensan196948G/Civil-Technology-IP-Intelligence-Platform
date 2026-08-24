import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { TAG_CLASS, type Tone } from './detail/types';

/** 種別・段階などの小さなラベル。 */
export function Tag({ tone = 'gray', children, style }: { tone?: Tone; children: ReactNode; style?: CSSProperties }) {
  return <span className={`badge ${TAG_CLASS[tone]}`} style={style}>{children}</span>;
}

export function Panel({
  title, note, action, children, style, bodyPadding = true
}: {
  title?: ReactNode;
  note?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
  bodyPadding?: boolean;
}) {
  return (
    <section className="panel" style={style}>
      {(title || action) && (
        <div className="panel-head">
          {title && <span className="panel-title">{title}</span>}
          {note && <span className="panel-note">{note}</span>}
          {action && <><span style={{ flex: 1 }} />{action}</>}
        </div>
      )}
      {children && (bodyPadding ? <div className="panel-body">{children}</div> : children)}
    </section>
  );
}

/** 一覧の絞り込みチップ。URLのクエリで状態を持つのでサーバ側だけで完結する。 */
export function FilterChips({
  chips, current, basePath, param
}: {
  chips: Array<{ key: string; label: string; count?: number }>;
  current: string;
  basePath: string;
  param: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {chips.map(c => (
        <Link
          key={c.key}
          href={`${basePath}?${param}=${encodeURIComponent(c.key)}`}
          className={`chip${current === c.key ? ' active' : ''}`}
        >
          {c.label}
          {c.count != null && <span className="chip-count">{c.count}</span>}
        </Link>
      ))}
    </div>
  );
}

export function Meter({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span className="meter" style={{ height }}>
      <span style={{ width: `${pct}%`, background: color }} />
    </span>
  );
}

/** 「AIは決めない」「根拠必須」など、消せない前提の注記。 */
export function Notice({
  tone = 'amber', children, style
}: { tone?: 'amber' | 'brick' | 'green' | 'blue'; children: ReactNode; style?: CSSProperties }) {
  return <div className={`notice notice-${tone}`} style={style}>{children}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="panel" style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-2)' }}>
      {children}
    </div>
  );
}
