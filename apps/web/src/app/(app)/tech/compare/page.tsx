import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { ymd } from '@/lib/labels';

export const runtime = 'edge';

export default async function TechComparePage() {
  const db = getDb(getDatabaseUrl());
  const analyses = await db.select().from(s.claimAnalyses).orderBy(desc(s.claimAnalyses.createdAt));

  const patentIds = [...new Set(analyses.map(a => a.patentId))];
  const technologyIds = [...new Set(analyses.map(a => a.technologyId))];
  const [patents, technologies] = await Promise.all([
    patentIds.length ? db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : Promise.resolve([]),
    technologyIds.length ? db.select().from(s.technologies).where(inArray(s.technologies.id, technologyIds)) : Promise.resolve([])
  ]);
  const patentById = new Map(patents.map(p => [p.id, p]));
  const techById = new Map(technologies.map(t => [t.id, t]));

  return (
    <ListView
      title="技術比較"
      moduleCode="S-06 / TECHNOLOGY INTELLIGENCE"
      description="他社特許と自社技術のClaim比較（構成要件レベルの照合）の一覧です。各件から詳細なClaim Chartを確認できます。"
      rows={analyses}
      emptyMessage="技術比較（Claim比較）のデータがまだありません。"
      rowHref={row => `/claims/${row.id}`}
      fields={[
        { key: 'patent', grow: true, render: row => (
          <span style={{ fontWeight: 700 }}>{patentById.get(row.patentId)?.title ?? '（削除済み特許）'}</span>
        ) },
        { key: 'tech', render: row => `自社案：${techById.get(row.technologyId)?.name ?? '（削除済み技術）'}` },
        { key: 'createdAt', mono: true, render: row => ymd(row.createdAt) }
      ]}
    />
  );
}
