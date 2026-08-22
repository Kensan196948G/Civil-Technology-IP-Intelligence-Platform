import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

export default async function ClaimElementsPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db
    .select({
      id: s.claimElements.id,
      label: s.claimElements.label,
      text: s.claimElements.text,
      seq: s.claimElements.seq,
      claimNo: s.patentClaims.claimNo,
      isIndependent: s.patentClaims.isIndependent,
      patentId: s.patents.id,
      patentTitle: s.patents.title
    })
    .from(s.claimElements)
    .innerJoin(s.patentClaims, eq(s.claimElements.claimId, s.patentClaims.id))
    .innerJoin(s.patents, eq(s.patentClaims.patentId, s.patents.id))
    .orderBy(desc(s.patents.retrievedAt), asc(s.patentClaims.claimNo), asc(s.claimElements.seq));

  return (
    <ListView
      title="構成要件分解"
      moduleCode="S-13 / CLAIM INTELLIGENCE"
      description="請求項を構成要件（claim_elements）単位に分解した一覧です。Claim Chart 比較の基礎データになります。"
      rows={rows}
      emptyMessage="構成要件分解データがまだありません。"
      rowHref={row => `/patents/${row.patentId}`}
      fields={[
        { key: 'label', mono: true, render: row => row.label },
        { key: 'text', grow: true, render: row => <span>{row.text.length > 80 ? row.text.slice(0, 80) + '…' : row.text}</span> },
        { key: 'claim', render: row => (
          <span style={{ color: 'var(--ink-2)', fontSize: 12 }}>
            請求項{row.claimNo}{row.isIndependent ? '（独立）' : '（従属）'} ｜ {row.patentTitle}
          </span>
        ) }
      ]}
    />
  );
}
