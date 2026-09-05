import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/current-user';
import { redirect } from 'next/navigation';
import { Meter, Notice } from '@/components/ui';

// M49 AI Governance & Evaluation — AI 実行の品質を評価・監査する。
// 各 AI 実行（ai_runs）に Model・Prompt版・Skill版・検索クエリ・参照ドキュメント・
// Citation Coverage・Confidence・Hallucination チェック・Human Review を紐付ける。
// 要件: FR-M49-001〜005（docs/90-project/06-first-wave-fr-drafts.md）
// 思想: Provenance（根拠の保持・ADR-0006）に加え、ガバナンスとして評価を記録・可視化する。

type EvalRow = {
  id: string;
  kind: string;
  model: string;
  status: string;
  createdAt: Date;
  promptVersion: string | null;
  skillVersion: string | null;
  searchQuery: string | null;
  referencedDocs: number;
  coverage: number;
  confidence: number | null;
  hallucinationChecked: boolean;
  hallucinationFlagged: boolean;
  humanReviewed: boolean;
  note: string | null;
};

const KIND_LABEL: Record<string, string> = {
  examine: 'AI模擬審査', claim_compare: 'Claim比較', field_score: '現場適用性評価',
  search: '検索', summarize: '要約'
};

export default async function AiGovernancePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb(getDatabaseUrl());

  const evals = await db.select().from(s.aiEvaluations).orderBy(desc(s.aiEvaluations.createdAt));
  const runIds = evals.map(e => e.aiRunId);
  const runs = runIds.length
    ? await db.select().from(s.aiRuns).where(inArray(s.aiRuns.id, runIds))
    : [];
  const runById = new Map(runs.map(r => [r.id, r]));

  const rows: EvalRow[] = evals.map(e => {
    const run = runById.get(e.aiRunId);
    return {
      id: e.id,
      kind: run?.kind ?? '?',
      model: run?.model ?? '—',
      status: run?.status ?? '?',
      createdAt: e.createdAt,
      promptVersion: e.promptVersion,
      skillVersion: e.skillVersion,
      searchQuery: e.searchQuery,
      referencedDocs: e.referencedDocs,
      coverage: Number(e.citationCoverage),
      confidence: e.confidence === null ? null : Number(e.confidence),
      hallucinationChecked: e.hallucinationChecked,
      hallucinationFlagged: e.hallucinationFlagged,
      humanReviewed: e.humanReviewed,
      note: e.note
    };
  });

  // 集計（ダッシュボード表示。FR-M49-005）
  const n = rows.length;
  const coverageAvg = n ? Math.round(rows.reduce((s, r) => s + r.coverage, 0) / n) : 0;
  const hallucinationFlaggedN = rows.filter(r => r.hallucinationFlagged).length;
  const humanReviewedN = rows.filter(r => r.humanReviewed).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>AI Governance（品質・監査）</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M49 / AI GOVERNANCE</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第一拡張群</span>
      </div>
      <Notice tone="blue" style={{ fontSize: 12 }}>
        AI の回答には必ず根拠（出典）が付きます（Provenance・ADR-0006）。ここではその**品質を評価・監査**するための
        メタ（Model・Prompt版・Skill版・Citation Coverage・Confidence・Hallucination チェック・Human Review）を記録します（FR-M49-001/002）。
      </Notice>

      {/* サマリ */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--blue)' }}>{n}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>評価済みAI実行</span>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: coverageAvg >= 90 ? 'var(--green)' : 'var(--amber)' }}>{coverageAvg}%</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>平均 Citation Coverage</span>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: hallucinationFlaggedN > 0 ? 'var(--brick)' : 'var(--green)' }}>{hallucinationFlaggedN}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>Hallucination 疑い</span>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--blue)' }}>{humanReviewedN} / {n}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>Human Review 済み</span>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          AI 評価メタ（ai_evaluations）がまだ登録されていません。
        </div>
      )}

      {/* 実行ごとの評価一覧 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => {
          const kind = KIND_LABEL[r.kind] ?? r.kind;
          return (
            <div key={r.id} className="card" style={{ padding: '12px 15px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{kind}</span>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{r.model}</span>
                <span style={{ flexGrow: 1 }} />
                {r.hallucinationFlagged && (
                  <span className="badge" style={{ color: 'var(--brick)', border: '1px solid var(--brick)' }}>Hallucination 疑い</span>
                )}
                <span className={`badge ${r.humanReviewed ? '' : ''}`} style={{
                  color: r.humanReviewed ? 'var(--green)' : 'var(--amber)',
                  border: `1px solid ${r.humanReviewed ? 'var(--green)' : 'var(--amber)'}`
                }}>
                  {r.humanReviewed ? 'Human Review 済' : 'Review 未実施'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Citation Coverage（根拠付与率）</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flexGrow: 1 }}><Meter value={r.coverage} color={r.coverage >= 90 ? 'var(--green)' : 'var(--amber)'} /></span>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{r.coverage}%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>参照ドキュメント</span>
                  <span className="mono" style={{ fontSize: 13 }}>{r.referencedDocs} 件</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Confidence</span>
                  <span className="mono" style={{ fontSize: 13 }}>{r.confidence === null ? '—' : r.confidence.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Prompt / Skill 版</span>
                  <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                    {r.promptVersion ?? '—'} / {r.skillVersion ?? '—'}
                  </span>
                </div>
              </div>

              {(r.searchQuery || r.note) && (
                <div style={{ fontSize: 11, color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {r.searchQuery && <span>検索クエリ: <span className="mono">{r.searchQuery}</span></span>}
                  {r.note && <span>評価メモ: {r.note}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
