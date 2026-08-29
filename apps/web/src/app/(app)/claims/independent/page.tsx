import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function IndependentClaimsPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db
    .select({
      id: s.patentClaims.id,
      claimNo: s.patentClaims.claimNo,
      text: s.patentClaims.text,
      patentId: s.patents.id,
      patentTitle: s.patents.title,
      applicantName: s.patents.applicantName
    })
    .from(s.patentClaims)
    .innerJoin(s.patents, eq(s.patentClaims.patentId, s.patents.id))
    .where(eq(s.patentClaims.isIndependent, true))
    .orderBy(desc(s.patents.retrievedAt), asc(s.patentClaims.claimNo));

  return (
    <ListView
      title="独立請求項"
      moduleCode="S-13 / CLAIM INTELLIGENCE"
      description="取り込み済み他社特許のうち、独立請求項（isIndependent=true）のみを一覧表示します。"
      rows={rows}
      emptyMessage="独立請求項のデータがまだありません。"
      rowHref={row => `/patents/${row.patentId}`}
      fields={[
        { key: 'claimNo', mono: true, render: row => `請求項${row.claimNo}` },
        { key: 'text', grow: true, render: row => <span>{row.text.length > 90 ? row.text.slice(0, 90) + '…' : row.text}</span> },
        { key: 'patent', render: row => <span style={{ color: 'var(--ink-2)', fontSize: 12 }}>{row.patentTitle}（{row.applicantName}）</span> }
      ]}
    />
  );
}
