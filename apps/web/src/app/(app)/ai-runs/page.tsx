import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, and, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resolveCitationLabels } from '@/lib/citations';
import { stamp } from '@/lib/labels';
import { getCurrentUser } from '@/lib/auth/current-user';
import { visibleWhere } from '@/lib/authz/row-visibility';

// #11 C3/C4 行レベル制御: 実行履歴のうち、対象発明（C3）を閲覧できない行は表示しない
// （履歴から C3 発明の存在を推測させない）。発明以外のターゲットは C2 相当とみなす。

type Run = typeof s.aiRuns.$inferSelect;

async function resolveTargets(db: ReturnType<typeof getDb>, runs: Run[]) {
  const inventionIds = runs.filter(r => r.targetType === 'invention' && r.targetId).map(r => r.targetId!);
  const analysisIds = runs.filter(r => r.targetType === 'claim_analysis' && r.targetId).map(r => r.targetId!);
  const fieldAppIds = runs.filter(r => r.targetType === 'field_application' && r.targetId).map(r => r.targetId!);

  const [inventionRows, analysisRows, fieldAppRows] = await Promise.all([
    inventionIds.length ? db.select().from(s.inventions).where(inArray(s.inventions.id, inventionIds)) : Promise.resolve([]),
    analysisIds.length ? db.select().from(s.claimAnalyses).where(inArray(s.claimAnalyses.id, analysisIds)) : Promise.resolve([]),
    fieldAppIds.length ? db.select().from(s.fieldApplications).where(inArray(s.fieldApplications.id, fieldAppIds)) : Promise.resolve([])
  ]);
  const inventionById = new Map(inventionRows.map(r => [r.id, r]));
  const analysisById = new Map(analysisRows.map(r => [r.id, r]));
  const fieldAppById = new Map(fieldAppRows.map(r => [r.id, r]));

  const targets = new Map<string, { label: string; href: string | null }>();
  for (const run of runs) {
    if (!run.targetType || !run.targetId) {
      targets.set(run.id, { label: '—', href: null });
    } else if (run.targetType === 'invention') {
      const row = inventionById.get(run.targetId);
      targets.set(run.id, { label: row ? `発明届：${row.title}` : '発明届（削除済み）', href: row ? `/inventions/${run.targetId}` : null });
    } else if (run.targetType === 'claim_analysis') {
      const row = analysisById.get(run.targetId);
      targets.set(run.id, { label: row ? 'Claim比較' : 'Claim比較（削除済み）', href: row ? `/claims/${run.targetId}` : null });
    } else if (run.targetType === 'field_application') {
      const row = fieldAppById.get(run.targetId);
      targets.set(run.id, { label: row ? '現場適用性評価' : '現場適用性評価（削除済み）', href: row ? `/field/${run.targetId}` : null });
    } else {
      targets.set(run.id, { label: `${run.targetType}：${run.targetId}`, href: null });
    }
  }
  return targets;
}

export default async function AiRunsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb(getDatabaseUrl());
  const runsAll = await db.select().from(s.aiRuns).orderBy(desc(s.aiRuns.createdAt));

  // #11: 対象発明を可視範囲で引き、不可視の C3 発明への実行履歴行を除外する
  // （履歴から C3 発明の存在を推測させない。README §14 ルール1）。
  const [me] = await db.select().from(s.users).where(eq(s.users.email, user.email)).limit(1);
  const inventionTargetIds = [...new Set(
    runsAll.filter(r => r.targetType === 'invention' && r.targetId).map(r => r.targetId!)
  )];
  const visibleInventions = inventionTargetIds.length
    ? await db.select().from(s.inventions).where(and(
        inArray(s.inventions.id, inventionTargetIds),
        visibleWhere(s.inventions.classification, s.inventions.submittedBy, { role: user.role, viewerUserId: me?.id })
      ))
    : [];
  const visibleInventionIds = new Set(visibleInventions.map(i => i.id));
  const runs = runsAll.filter(r =>
    r.targetType !== 'invention' || (r.targetId && visibleInventionIds.has(r.targetId))
  );
  const runIds = runs.map(r => r.id);
  const citations = runIds.length
    ? await db.select().from(s.aiCitations).where(inArray(s.aiCitations.aiRunId, runIds))
    : [];
  const citationsByRun = new Map<string, typeof citations>();
  for (const c of citations) {
    const arr = citationsByRun.get(c.aiRunId) ?? [];
    arr.push(c);
    citationsByRun.set(c.aiRunId, arr);
  }

  const [targetsByRun, citationLabels] = await Promise.all([
    resolveTargets(db, runs),
    resolveCitationLabels(db, citations)
  ]);

  const rows = runs.map(run => ({
    run,
    target: targetsByRun.get(run.id)!,
    citationLabels: (citationsByRun.get(run.id) ?? []).map(c => ({ c, label: citationLabels.get(c.id)! }))
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>AI実行履歴・根拠</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-24 / AI PROVENANCE</span>
      </div>
      <div className="notice notice-blue" style={{ fontSize: 12.5 }}>
        <strong>AIは決めません。AIの回答には必ず出どころが付きます。</strong>
        このシステム内のすべてのAI実行は、判断根拠となった特許・NETIS・自社技術データを紐付けて記録します。
      </div>

      {rows.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          AI実行履歴はまだありません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(({ run, target, citationLabels }) => (
          <div key={run.id} className="card" style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{run.kind}</span>
              <span className="badge" style={{ color: run.status === 'succeeded' ? 'var(--green)' : 'var(--amber)', border: `1px solid ${run.status === 'succeeded' ? 'var(--green)' : 'var(--amber)'}` }}>{run.status}</span>
              <span style={{ flexGrow: 1 }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{stamp(run.createdAt)}</span>
            </div>
            {target.href ? (
              <Link href={target.href} style={{ fontSize: 13, fontWeight: 700 }}>{target.label} →</Link>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 700 }}>{target.label}</span>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>モデル：{run.model}</div>
            {citationLabels.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 12, borderLeft: '2px solid var(--line)' }}>
                {citationLabels.map(({ c, label }) => (
                  <div key={c.id} style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--ink-2)' }}>{label}</span>：「{c.quotedText}」
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
