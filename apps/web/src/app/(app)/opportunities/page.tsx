import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { Meter, Notice } from '@/components/ui';

// M45 Innovation Opportunity Intelligence — 研究テーマ候補を機会スコアでランキング提示する。
// 入力要素: White Space・現場ニーズ・競合強度・論文増加率・NETIS・市場性・Safety・GX・難易度（各0-100）。
// 要件: FR-M45-001〜004（docs/90-project/06-first-wave-fr-drafts.md）
// 原則: スコアは「検討候補の並び替え材料」。テーマの最終決定は経営・技術委員会が行う（FR-M45-003）。

const FACTOR_META: Array<{ key: string; label: string; color: string }> = [
  { key: 'white_space', label: '特許空白', color: 'var(--blue)' },
  { key: 'need', label: '現場ニーズ', color: 'var(--brick)' },
  { key: 'competition', label: '競合強度', color: 'var(--amber)' },
  { key: 'paper_growth', label: '論文増加率', color: '#7c5cbf' },
  { key: 'netis', label: 'NETIS', color: '#1e7d46' },
  { key: 'market', label: '市場性', color: 'var(--blue-bar)' },
  { key: 'safety', label: 'Safety', color: 'var(--green)' },
  { key: 'gx', label: 'GX', color: '#1e7d46' },
  { key: 'difficulty', label: '開発難易度', color: 'var(--ink-2)' }
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  candidate: { label: '候補', color: 'var(--ink-2)' },
  shortlisted: { label: '候補に残った', color: 'var(--amber)' },
  decided: { label: 'テーマ決定', color: 'var(--green)' },
  rejected: { label: '見送り', color: 'var(--brick)' }
};

export default async function OpportunitiesPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.innovationOpportunities)
    .orderBy(desc(s.innovationOpportunities.opportunityScore));

  const countBy = (st: string) => rows.filter(r => r.status === st).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>研究テーマ候補（Innovation Opportunity）</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M45 / OPPORTUNITY</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第一拡張群</span>
      </div>
      <Notice tone="amber" style={{ fontSize: 12 }}>
        スコアは「研究テーマ候補の並び替え材料」です。**テーマの最終決定は経営・技術委員会が行います**（FR-M45-003）。
        White Space・現場ニーズ等の各要素とその根拠（basis）を確認したうえで判断してください。
      </Notice>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_META).map(([k, meta]) => (
          <div key={k} className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span className="mono" style={{ fontSize: 20, color: meta.color }}>{countBy(k)}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{meta.label}</span>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          研究テーマ候補がまだ登録されていません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(o => {
          const factors = (o.factors ?? {}) as Record<string, number>;
          const basis = (o.basis ?? {}) as Record<string, string>;
          const score = Number(o.opportunityScore);
          const status = STATUS_META[o.status] ?? { label: o.status, color: 'var(--ink-2)' };
          return (
            <div key={o.id} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{o.title}</span>
                  <span className="badge" style={{ color: status.color, border: `1px solid ${status.color}` }}>{status.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
                  <span className="mono" style={{ fontSize: 28, color: score >= 75 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--ink-2)' }}>{score.toFixed(1)}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>/ 100</span>
                </div>
              </div>
              {o.description && <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{o.description}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {FACTOR_META.map(f => {
                  const value = factors[f.key] ?? 0;
                  return (
                    <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 92, flexShrink: 0, fontSize: 11, color: 'var(--ink-2)' }}>{f.label}</span>
                      <span style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Meter value={value} color={f.color} height={5} />
                        {basis[f.key] && <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{basis[f.key]}</span>}
                      </span>
                      <span className="mono" style={{ width: 30, flexShrink: 0, textAlign: 'right', fontSize: 10.5, color: 'var(--ink-2)' }}>{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
