import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

type DedupRow = { id: string; masterName: string; sourceName: string; patentN: number };
type RawRow = { id: string; master_name: string; source_name: string; patent_n: number };

export default async function DataDedupPage() {
  const db = getDb(getDatabaseUrl());
  // 特許の出願人名（patents.applicant_name）と競合企業マスタ（competitors.name）を
  // 正規化（前後空白除去・大文字小文字無視）して突き合わせ、名寄せ済みの実体対応を一覧化する。
  const result = await db.execute(sql`
    select
      c.id as id,
      c.name as master_name,
      p.applicant_name as source_name,
      count(p.id)::int as patent_n
    from competitors c
    join patents p on lower(trim(p.applicant_name)) = lower(trim(c.name))
    group by c.id, c.name, p.applicant_name
    order by c.name asc
  `);
  const rows: DedupRow[] = (result.rows as unknown as RawRow[]).map(r => ({
    id: r.id, masterName: r.master_name, sourceName: r.source_name, patentN: Number(r.patent_n)
  }));

  return (
    <ListView
      title="名寄せ"
      moduleCode="S-18h / ENTITY RESOLUTION"
      description="特許出願人名（patents.applicant_name）と競合企業マスタ（competitors）を正規化して突き合わせ、同一実体として名寄せされた組み合わせを一覧化します。正規化ルール：前後空白除去＋大文字小文字を無視した一致。"
      badge="MVP"
      rows={rows}
      emptyMessage="名寄せ対象（正規化一致するレコード）は検出されませんでした。"
      fields={[
        { key: 'masterName', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.masterName}</span> },
        { key: 'arrow', render: () => <span style={{ color: 'var(--ink-2)' }}>＝</span> },
        { key: 'sourceName', render: row => row.sourceName },
        { key: 'patentN', render: row => <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>特許{row.patentN}件</span> }
      ]}
    />
  );
}
