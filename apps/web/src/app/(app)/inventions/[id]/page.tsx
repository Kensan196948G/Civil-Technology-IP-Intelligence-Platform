import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { resolveCitationLabels } from '@/lib/citations';


export default async function InventionDetailPage({ params }: { params: { id: string } }) {
  const db = getDb(getDatabaseUrl());
  const [invention] = await db.select().from(s.inventions).where(eq(s.inventions.id, params.id)).limit(1);
  if (!invention) notFound();

  const [submitter] = await db.select().from(s.users).where(eq(s.users.id, invention.submittedBy)).limit(1);
  const [site] = invention.siteId
    ? await db.select().from(s.sites).where(eq(s.sites.id, invention.siteId)).limit(1)
    : [null];
  const [workflow] = await db.select().from(s.workflowInstances).where(
    and(eq(s.workflowInstances.subjectType, 'invention'), eq(s.workflowInstances.subjectId, invention.id))
  ).limit(1);

  const runs = await db.select().from(s.aiRuns).where(
    and(eq(s.aiRuns.targetType, 'invention'), eq(s.aiRuns.targetId, invention.id))
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
  const citationLabels = await resolveCitationLabels(db, citations);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>{invention.title}</h1>
        <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{invention.classification}</span>
      </div>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        <div>起案：{submitter?.displayName ?? '—'} ｜ 現場：{site?.name ?? '—'}</div>
        {invention.summary && <div style={{ color: 'var(--ink-2)' }}>{invention.summary}</div>}
      </div>

      {workflow && (
        <Link href={`/approvals/${workflow.id}`} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
          審査ワークフローを見る（現在：{workflow.status}）→
        </Link>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          AI一次レビュー履歴（出どころ付き）
        </div>
        {runs.length === 0 ? (
          <div style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--ink-2)' }}>
            AIによる一次レビューはまだ実行されていません。
          </div>
        ) : (
          <div>
            {runs.map(run => (
              <div key={run.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{run.kind}</span>
                  <span className="badge" style={{ color: run.status === 'succeeded' ? 'var(--green)' : 'var(--amber)', border: `1px solid ${run.status === 'succeeded' ? 'var(--green)' : 'var(--amber)'}` }}>{run.status}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>モデル：{run.model}</span>
                </div>
                {(citationsByRun.get(run.id) ?? []).map(c => (
                  <div key={c.id} style={{ fontSize: 12, paddingLeft: 12, borderLeft: '2px solid var(--line)' }}>
                    <div style={{ color: 'var(--ink-2)' }}>{citationLabels.get(c.id)}</div>
                    <div>「{c.quotedText}」</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
