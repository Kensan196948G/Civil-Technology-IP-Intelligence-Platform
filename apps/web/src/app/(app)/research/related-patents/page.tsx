import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { ymd } from '@/lib/labels';

export const runtime = 'edge';

export default async function ResearchRelatedPatentsPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.claimAnalyses).orderBy(desc(s.claimAnalyses.createdAt)).limit(100);

  const patentIds = [...new Set(rows.map(r => r.patentId))];
  const techIds = [...new Set(rows.map(r => r.technologyId))];
  const [patentRows, techRows] = await Promise.all([
    patentIds.length ? db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : Promise.resolve([]),
    techIds.length ? db.select().from(s.technologies).where(inArray(s.technologies.id, techIds)) : Promise.resolve([])
  ]);
  const patentById = new Map(patentRows.map(p => [p.id, p]));
  const techById = new Map(techRows.map(t => [t.id, t]));

  return (
    <ListView
      title="特許との関連"
      moduleCode="S-07g / PATENT RELEVANCE"
      description="研究・自社技術と他社特許とのClaim比較（構成要件対比）分析の一覧です。各件から詳細なClaim Chartを確認できます。"
      rows={rows}
      emptyMessage="特許との関連分析（Claim比較）はまだありません。"
      rowHref={row => `/claims/${row.id}`}
      fields={[
        { key: 'patent', grow: true, render: row => <span style={{ fontWeight: 700 }}>{patentById.get(row.patentId)?.title ?? '特許（削除済み）'}</span> },
        { key: 'tech', render: row => `関連技術：${techById.get(row.technologyId)?.name ?? '—'}` },
        { key: 'createdAt', mono: true, render: row => ymd(row.createdAt) }
      ]}
    />
  );
}
