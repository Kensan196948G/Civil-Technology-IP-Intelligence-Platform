import type { ReactNode } from 'react';

export type InfoBlock = { label: string; value: ReactNode };

export function InfoPage({
  title, moduleCode, description, blocks, note, children, badge
}: {
  title: string;
  moduleCode: string;
  description?: string;
  blocks?: InfoBlock[];
  note?: string;
  children?: ReactNode;
  badge?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>{title}</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>{moduleCode}</span>
        {badge && <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>{badge}</span>}
      </div>
      {description && <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{description}</p>}

      {blocks && blocks.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          {blocks.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < blocks.length - 1 ? '1px solid #E8EDED' : 'none' }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink-2)', width: 200, flexShrink: 0 }}>{b.label}</span>
              <span style={{ fontSize: 13 }}>{b.value}</span>
            </div>
          ))}
        </div>
      )}

      {children}

      {note && (
        <div className="notice notice-blue" style={{ fontSize: 12 }}>{note}</div>
      )}
    </div>
  );
}
