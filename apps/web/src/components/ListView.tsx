import Link from 'next/link';
import type { ReactNode } from 'react';

export type ListField<T> = {
  key: string;
  render: (row: T) => ReactNode;
  mono?: boolean;
  grow?: boolean;
};

export function ListView<T extends { id: string }>({
  title, moduleCode, description, fields, rows, emptyMessage, rowHref, badge
}: {
  title: string;
  moduleCode: string;
  description?: string;
  fields: ListField<T>[];
  rows: T[];
  emptyMessage: string;
  rowHref?: (row: T) => string;
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

      {rows.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          {emptyMessage}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(row => {
          const content = fields.map(f => (
            <span key={f.key} className={f.mono ? 'mono' : undefined} style={{ flexGrow: f.grow ? 1 : 0 }}>
              {f.render(row)}
            </span>
          ));
          const href = rowHref?.(row);
          return href ? (
            <Link key={row.id} href={href} className="card" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink)' }}>
              {content}
            </Link>
          ) : (
            <div key={row.id} className="card" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
