import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { resolveLicenseSubjects, LICENSE_STATUS_LABEL, LICENSE_STATUS_COLOR } from '@/lib/licensing-subjects';

export const runtime = 'edge';

type Row = { id: string; strategy: 'Build' | 'Buy' | 'Partner'; title: string; sub: string; status?: string };

const STRATEGY_COLOR: Record<Row['strategy'], string> = { Build: 'var(--green)', Buy: 'var(--blue)', Partner: 'var(--amber)' };

export default async function StrategyPage() {
  const db = getDb(getDatabaseUrl());
  const technologies = await db.select().from(s.technologies).orderBy(desc(s.technologies.createdAt));
  const licenses = await db.select().from(s.licenses).orderBy(desc(s.licenses.createdAt));
  const subjects = await resolveLicenseSubjects(db, licenses);

  const rows: Row[] = [
    ...technologies.map(t => ({ id: `build-${t.id}`, strategy: 'Build' as const, title: t.name, sub: `自社保有技術 ｜ ${t.kind}` })),
    ...licenses.map(l => ({
      id: `deal-${l.id}`,
      strategy: (l.kind === 'license_in' ? 'Buy' : 'Partner') as Row['strategy'],
      title: subjects.label(l.subjectType, l.subjectId),
      sub: l.kind === 'license_in' ? `導入元：${l.counterpartName}` : `供与先：${l.counterpartName}`,
      status: l.status
    }))
  ];

  return (
    <ListView
      title="Buy / Build / Partner 戦略マップ"
      moduleCode="S-11h / LICENSING & IP PORTFOLIO"
      description="自社保有技術（Build）・技術導入案件（Buy）・ライセンスアウト案件（Partner）を1つの戦略軸で横断表示します。"
      rows={rows}
      emptyMessage="戦略マップの対象データがまだありません。"
      fields={[
        { key: 'strategy', render: row => (
          <span className="badge" style={{ color: STRATEGY_COLOR[row.strategy], border: `1px solid ${STRATEGY_COLOR[row.strategy]}` }}>{row.strategy}</span>
        ) },
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'sub', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.sub}</span> },
        { key: 'status', render: row => row.status ? (
          <span className="badge" style={{ color: LICENSE_STATUS_COLOR[row.status] ?? 'var(--ink-2)', border: `1px solid ${LICENSE_STATUS_COLOR[row.status] ?? 'var(--line)'}` }}>
            {LICENSE_STATUS_LABEL[row.status] ?? row.status}
          </span>
        ) : null }
      ]}
    />
  );
}
