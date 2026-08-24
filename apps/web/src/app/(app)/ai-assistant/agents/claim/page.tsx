import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { ymd } from '@/lib/labels';

export const runtime = 'edge';

export default async function ClaimAgentPage() {
  const db = getDb(getDatabaseUrl());
  const analyses = await db.select().from(s.claimAnalyses).orderBy(desc(s.claimAnalyses.createdAt));

  const patentIds = [...new Set(analyses.map(a => a.patentId))];
  const techIds = [...new Set(analyses.map(a => a.technologyId))];
  const [patentRows, techRows] = await Promise.all([
    patentIds.length ? db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : Promise.resolve([]),
    techIds.length ? db.select().from(s.technologies).where(inArray(s.technologies.id, techIds)) : Promise.resolve([])
  ]);
  const patentById = new Map(patentRows.map(p => [p.id, p]));
  const techById = new Map(techRows.map(t => [t.id, t]));

  return (
    <ListView
      title="Claim Agent"
      moduleCode="S-14 / AI ASSISTANT"
      description="他社特許の請求項と自社案の構成要件をAIが対比するAgentです。claim_analyses台帳の比較結果を一覧表示します。行から詳細な構成要件チャートを確認できます。"
      rows={analyses}
      emptyMessage="Claim Agentによる比較結果はまだありません。"
      rowHref={row => `/claims/${row.id}`}
      fields={[
        { key: 'patent', grow: true, render: row => <span style={{ fontWeight: 700 }}>{patentById.get(row.patentId)?.title ?? '（削除済み特許）'}</span> },
        { key: 'vs', render: () => <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>vs</span> },
        { key: 'tech', render: row => <span style={{ fontSize: 12.5 }}>{techById.get(row.technologyId)?.name ?? '（削除済み技術）'}</span> },
        { key: 'createdAt', mono: true, render: row => ymd(row.createdAt) }
      ]}
    />
  );
}
