import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type Row = { id: string; title: string; applicantName: string; country: string };
type RawRow = { id: string; title: string; applicant_name: string; country: string };

export default async function LandscapeCoFilingPage() {
  const db = getDb(getDatabaseUrl());
  // 現スキーマでは applicant_name は単一テキストのため、共同出願（複数出願人）は
  // 「、」「,」「/」「&」「and」等の区切り文字を含む出願人名から検出する。
  const res = await db.execute(sql`
    select id, title, applicant_name, country
    from patents
    where applicant_name ~ '[、,/&]| and | with '
    order by applicant_name asc
  `);
  const rows: Row[] = (res.rows as unknown as RawRow[]).map(p => ({
    id: p.id, title: p.title, applicantName: p.applicant_name, country: p.country
  }));

  return (
    <ListView
      title="共同出願分析"
      moduleCode="S-09 / LANDSCAPE — CO-FILING"
      description="出願人名に複数当事者を示す区切り文字（、/,/&/and等）を含む特許を共同出願候補として検出します。"
      rows={rows}
      emptyMessage="共同出願（複数出願人）と判定された特許は現在のデータには見つかりませんでした。"
      rowHref={row => `/patents/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'applicantName', render: row => row.applicantName },
        { key: 'country', mono: true, render: row => row.country }
      ]}
    />
  );
}
