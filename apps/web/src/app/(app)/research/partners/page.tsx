import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

// M41 Research Partner Intelligence — 大学・研究機関・企業・Startup のネットワークを
// 管理し、共同研究候補の発掘と連携状況を俯瞰する。

const KIND_META: Record<string, { label: string; icon: string }> = {
  university: { label: '大学', icon: '🎓' },
  research_institute: { label: '研究機関', icon: '🔬' },
  company: { label: '企業', icon: '🏢' },
  startup: { label: 'Startup', icon: '💡' }
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  none: { label: '未接触', color: 'var(--ink-2)' },
  exploring: { label: '探索中', color: 'var(--blue)' },
  nda: { label: 'NDA締結', color: 'var(--amber)' },
  joint_research: { label: '共同研究中', color: 'var(--green)' },
  contract: { label: '契約済', color: 'var(--green)' }
};

export default async function PartnersPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.researchPartners).orderBy(asc(s.researchPartners.name));

  const byStatus = Object.entries(STATUS_META).map(([k, meta]) => ({
    label: meta.label,
    count: rows.filter(r => r.collaborationStatus === k).length
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>研究パートナー</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M41 / PARTNER INTELLIGENCE</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第二拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        大学・研究機関・企業・Startup の研究ネットワークを管理し、共同研究の候補発掘と連携状況を俯瞰します。
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {byStatus.map(st => (
          <div key={st.label} className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span className="mono" style={{ fontSize: 18, color: 'var(--blue)' }}>{st.count}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{st.label}</span>
          </div>
        ))}
      </div>

      <ListView
        title="研究パートナー一覧"
        moduleCode="M41 / PARTNER INTELLIGENCE"
        rows={rows}
        emptyMessage="研究パートナーがまだ登録されていません。"
        fields={[
          { key: 'kind', render: row => {
            const m = KIND_META[row.kind] ?? { label: row.kind, icon: '•' };
            return <span style={{ fontSize: 12 }}>{m.icon} {m.label}</span>;
          } },
          { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
          { key: 'field', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.field ?? '—'}</span> },
          { key: 'status', render: row => {
            const st = STATUS_META[row.collaborationStatus] ?? { label: row.collaborationStatus, color: 'var(--ink-2)' };
            return <span className="badge" style={{ color: st.color, border: `1px solid ${st.color}` }}>{st.label}</span>;
          } },
          { key: 'contact', mono: true, render: row => row.contactPerson ?? '—' }
        ]}
      />
    </div>
  );
}
