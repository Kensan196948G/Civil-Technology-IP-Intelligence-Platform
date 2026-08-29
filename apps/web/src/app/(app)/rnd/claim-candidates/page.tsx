export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { stamp } from '@/lib/labels';


export default async function RndClaimCandidatesPage() {
  const db = getDb(getDatabaseUrl());
  const runs = await db.select().from(s.aiRuns).where(eq(s.aiRuns.kind, 'claim_compare')).orderBy(desc(s.aiRuns.createdAt));

  const analysisIds = [...new Set(runs.filter(r => r.targetType === 'claim_analysis' && r.targetId).map(r => r.targetId!))];
  const analyses = analysisIds.length ? await db.select().from(s.claimAnalyses).where(inArray(s.claimAnalyses.id, analysisIds)) : [];
  const analysisById = new Map(analyses.map(a => [a.id, a]));

  const patentIds = [...new Set(analyses.map(a => a.patentId))];
  const technologyIds = [...new Set(analyses.map(a => a.technologyId))];
  const patents = patentIds.length ? await db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : [];
  const technologies = technologyIds.length ? await db.select().from(s.technologies).where(inArray(s.technologies.id, technologyIds)) : [];
  const patentById = new Map(patents.map(p => [p.id, p]));
  const techById = new Map(technologies.map(t => [t.id, t]));

  const rows = runs.map(run => {
    const analysis = run.targetId ? analysisById.get(run.targetId) : undefined;
    const patent = analysis ? patentById.get(analysis.patentId) : undefined;
    const tech = analysis ? techById.get(analysis.technologyId) : undefined;
    return {
      id: run.id,
      analysisId: analysis?.id,
      patentTitle: patent?.title ?? '対象Claim比較（削除済み）',
      techName: tech?.name,
      status: run.status,
      model: run.model,
      createdAt: run.createdAt
    };
  });

  return (
    <ListView
      title="Claim候補生成"
      moduleCode="S-10 / CLAIM CANDIDATE GENERATION"
      description="他社特許のClaimと自社案を比較し、出願候補となりうる差分をAIが抽出した実行履歴です。"
      rows={rows}
      emptyMessage="Claim候補生成の実行履歴はまだありません。"
      rowHref={row => row.analysisId ? `/claims/${row.analysisId}` : ''}
      fields={[
        { key: 'patent', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.patentTitle}</span> },
        { key: 'tech', render: row => row.techName ? `vs. ${row.techName}` : '—' },
        { key: 'model', mono: true, render: row => row.model },
        { key: 'status', render: row => (
          <span className="badge" style={{ color: row.status === 'succeeded' ? 'var(--green)' : 'var(--amber)', border: `1px solid ${row.status === 'succeeded' ? 'var(--green)' : 'var(--amber)'}` }}>{row.status}</span>
        ) },
        { key: 'createdAt', mono: true, render: row => stamp(row.createdAt) }
      ]}
    />
  );
}
