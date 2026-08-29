export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


const KIND_LABEL: Record<string, string> = { patent: '特許', paper: '論文', netis: 'NETIS' };

type CleansingRow = { id: string; entityId: string; kind: string; title: string; issue: string };
type RawRow = { id: string; kind: string; title: string; issue: string };

export default async function DataCleansingPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select id, 'patent' as kind, title, '要約（abstract）欠落' as issue
      from patents where abstract is null or abstract = ''
    union all
    select id, 'patent' as kind, title, '出願日欠落' as issue
      from patents where application_date is null
    union all
    select id, 'patent' as kind, title, '公開番号欠落' as issue
      from patents where publication_no is null or publication_no = ''
    union all
    select id, 'paper' as kind, title, '要約（abstract）欠落' as issue
      from papers where abstract is null or abstract = ''
    union all
    select id, 'netis' as kind, name as title, '概要（summary）欠落' as issue
      from netis_technologies where summary is null or summary = ''
    order by kind, title
    limit 200
  `);
  const rows: CleansingRow[] = (result.rows as unknown as RawRow[]).map(r => ({
    id: `${r.kind}-${r.id}-${r.issue}`, entityId: r.id, kind: r.kind, title: r.title, issue: r.issue
  }));

  return (
    <ListView
      title="データクレンジング"
      moduleCode="S-18g / DATA CLEANSING"
      description="必須項目が欠落しているレコードを自動検出したクレンジング対象キューです。特許・論文・NETIS技術の主要項目（要約・出願日・番号）の欠落を横断チェックします。"
      badge="MVP"
      rows={rows}
      emptyMessage="クレンジングが必要なレコードは検出されませんでした（主要項目の欠落なし）。"
      rowHref={row => row.kind === 'patent' ? `/patents/${row.entityId}` : row.kind === 'netis' ? `/netis/${row.entityId}` : ''}
      fields={[
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{KIND_LABEL[row.kind] ?? row.kind}</span>
        ) },
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'issue', render: row => (
          <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>{row.issue}</span>
        ) }
      ]}
    />
  );
}
