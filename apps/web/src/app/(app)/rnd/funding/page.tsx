import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

// M42 R&D Funding Intelligence（第二拡張群）
// NEDO・JST・SIP・BRIDGE等の研究助成制度と、研究テーマ（technologies＝M14 R&D Intelligence）との
// マッチングを一覧する。研究テーマ自体は既存の technologies テーブル（/rnd/themes）をそのまま用いる。

type FundingProgramRow = {
  id: string;
  agency: string;
  name: string;
  field: string | null;
  amount_range: string | null;
  application_deadline: string | null;
  is_sample: boolean;
  match_count: string;
  max_score: string | null;
};

export default async function RndFundingPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select
      fp.id, fp.agency, fp.name, fp.field, fp.amount_range, fp.application_deadline, fp.is_sample,
      count(fm.id) as match_count,
      max(fm.match_score) as max_score
    from funding_programs fp
    left join funding_matches fm on fm.funding_program_id = fp.id
    group by fp.id
    order by max(fm.match_score) desc nulls last, fp.application_deadline asc nulls last
  `);
  const rows = result.rows as FundingProgramRow[];

  return (
    <ListView
      title="助成金マッチング"
      moduleCode="M42 / R&D FUNDING INTELLIGENCE"
      badge="第二拡張群"
      description="NEDO・JST・SIP・BRIDGE等の研究助成制度と、研究テーマ（/rnd/themes）とのマッチング候補を一覧します。"
      rows={rows}
      emptyMessage="助成制度データがまだありません。"
      rowHref={row => `/rnd/funding/${row.id}`}
      fields={[
        { key: 'agency', mono: true, render: row => <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.agency}</span> },
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'field', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.field ?? '—'}</span> },
        { key: 'amount', mono: true, render: row => row.amount_range ?? '—' },
        { key: 'deadline', mono: true, render: row => row.application_deadline ?? '—' },
        { key: 'matches', render: row => {
          const count = Number(row.match_count);
          if (count === 0) return <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>マッチなし</span>;
          const max = row.max_score !== null ? Number(row.max_score).toFixed(0) : '—';
          return <span style={{ fontSize: 12 }}>候補 {count} 件 ｜ 最高スコア <span className="mono" style={{ color: 'var(--blue)' }}>{max}</span></span>;
        } },
        { key: 'sample', render: row => row.is_sample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}
