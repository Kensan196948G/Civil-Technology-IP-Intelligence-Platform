import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';

export const runtime = 'edge';

async function resolveTarget(db: ReturnType<typeof getDb>, targetType: string | null, targetId: string | null) {
  if (!targetType || !targetId) return { label: '—', href: null as string | null };
  if (targetType === 'invention') {
    const [row] = await db.select().from(s.inventions).where(eq(s.inventions.id, targetId)).limit(1);
    return { label: row ? `発明届：${row.title}` : '発明届（削除済み）', href: row ? `/inventions/${targetId}` : null };
  }
  if (targetType === 'claim_analysis') {
    const [row] = await db.select().from(s.claimAnalyses).where(eq(s.claimAnalyses.id, targetId)).limit(1);
    return { label: row ? 'Claim比較' : 'Claim比較（削除済み）', href: row ? `/claims/${targetId}` : null };
  }
  if (targetType === 'field_application') {
    const [row] = await db.select().from(s.fieldApplications).where(eq(s.fieldApplications.id, targetId)).limit(1);
    return { label: row ? '現場適用性評価' : '現場適用性評価（削除済み）', href: row ? `/field/${targetId}` : null };
  }
  return { label: `${targetType}：${targetId}`, href: null };
}

async function resolveCitationLabel(db: ReturnType<typeof getDb>, sourceType: string, sourceId: string) {
  if (sourceType === 'patent') {
    const [p] = await db.select().from(s.patents).where(eq(s.patents.id, sourceId)).limit(1);
    return p ? `特許：${p.title}` : '特許（削除済み）';
  }
  if (sourceType === 'netis') {
    const [n] = await db.select().from(s.netisTechnologies).where(eq(s.netisTechnologies.id, sourceId)).limit(1);
    return n ? `NETIS：${n.name}` : 'NETIS（削除済み）';
  }
  if (sourceType === 'technology') {
    const [t] = await db.select().from(s.technologies).where(eq(s.technologies.id, sourceId)).limit(1);
    return t ? `自社技術：${t.name}` : '自社技術（削除済み）';
  }
  return `${sourceType}：${sourceId}`;
}

export default async function AiRunsPage() {
  const db = getDb(getDatabaseUrl());
  const runs = await db.select().from(s.aiRuns).orderBy(desc(s.aiRuns.createdAt));
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

  const rows = await Promise.all(runs.map(async run => ({
    run,
    target: await resolveTarget(db, run.targetType, run.targetId),
    citationLabels: await Promise.all((citationsByRun.get(run.id) ?? []).map(async c => ({
      c, label: await resolveCitationLabel(db, c.sourceType, c.sourceId)
    })))
  })));

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
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{String(run.createdAt).slice(0, 16)}</span>
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
