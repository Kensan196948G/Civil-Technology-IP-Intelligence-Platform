import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { Notice, Meter } from '@/components/ui';

// M32 IP Value & Quality Intelligence — 特許ごとの価値・品質を複数要素から評価する。
// 要素: 技術力 / 権利強度 / 市場性 / 競合重要性 / 現場適用性 / 残存期間 / コスト効率（各0-100）
// Strategic Score は各要素×重みの加重平均。
// 原則: スコアは「検討候補の並び替え材料」。維持・放棄・ライセンス等の決定は AI は行わない
// （最終判断は知財委員会・経営。FR-M32-002/003）。

const ELEMENT_META: Array<{ key: string; label: string; color: string }> = [
  { key: 'technology', label: '技術力', color: 'var(--blue)' },
  { key: 'patent_strength', label: '権利強度', color: 'var(--brick)' },
  { key: 'market', label: '市場性', color: 'var(--amber)' },
  { key: 'competitor_importance', label: '競合重要性', color: '#b7791f' },
  { key: 'field_applicability', label: '現場適用性', color: 'var(--green)' },
  { key: 'remaining_life', label: '残存期間', color: '#7c5cbf' },
  { key: 'cost', label: 'コスト効率', color: 'var(--ink-2)' }
];

const ACTION_META: Record<string, { label: string; color: string; icon: string }> = {
  maintain: { label: '維持', color: 'var(--green)', icon: '🟢' },
  additional_filing: { label: '追加出願', color: 'var(--blue)', icon: '📝' },
  joint_research: { label: '共同研究', color: 'var(--purple)', icon: '🤝' },
  license_out: { label: 'ライセンス', color: 'var(--amber)', icon: '🔓' },
  sell: { label: '売却候補', color: '#b7791f', icon: '💼' },
  consider_abandon: { label: '放棄検討', color: 'var(--brick)', icon: '⚠️' }
};

export default async function IpValuePage() {
  const db = getDb(getDatabaseUrl());
  const scores = await db.select().from(s.ipValueScores).orderBy(desc(s.ipValueScores.strategicScore));
  const patentIds = scores.map(x => x.patentId);
  const patents = patentIds.length
    ? await db.select().from(s.patents).where(inArray(s.patents.id, patentIds))
    : [];
  const patentById = new Map(patents.map(p => [p.id, p]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22 }}>IP価値評価（Strategic Score）</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M32 / IP VALUE</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第一拡張群</span>
        {/* FR-M32-004: M17 ポートフォリオへの遷移 */}
        <a href="/licensing/portfolio" style={{ fontSize: 12, color: 'var(--blue)', marginLeft: 'auto' }}>ポートフォリオ全体を見る →</a>
      </div>
      <Notice tone="amber" style={{ fontSize: 12 }}>
        スコアは「維持・ライセンス・追加出願・共同研究・売却・放棄」の検討候補を並べる材料です。ここでは決定を行いません（FR-M32-003）。各要素の数値と根拠（basis）を確認し、最終判断は知財委員会・経営が行います。
      </Notice>

      {scores.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          IP価値評価（ip_value_scores）がまだ登録されていません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {scores.map(sc => {
          const patent = patentById.get(sc.patentId);
          const elements = (sc.elements ?? {}) as Record<string, number>;
          const basis = (sc.basis ?? {}) as Record<string, string>;
          const candidates = (sc.candidates ?? []) as Array<{ action: string; reason: string }>;
          const total = Number(sc.strategicScore);
          return (
            <div key={sc.id} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5 }}>{patent?.title ?? '特許（削除済み）'}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                    {patent?.applicantName ?? '—'} ｜ <span className="mono">{patent?.publicationNo ?? '—'}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
                  <span className="mono" style={{ fontSize: 30, color: total >= 80 ? 'var(--green)' : total >= 60 ? 'var(--amber)' : 'var(--brick)' }}>{total.toFixed(1)}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>/ 100</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {ELEMENT_META.map(m => {
                  const value = elements[m.key] ?? 0;
                  return (
                    <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 84, flexShrink: 0, fontSize: 11, color: 'var(--ink-2)' }}>{m.label}</span>
                      <span style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Meter value={value} color={m.color} />
                        {basis[m.key] && <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{basis[m.key]}</span>}
                      </span>
                      <span className="mono" style={{ width: 34, flexShrink: 0, textAlign: 'right', fontSize: 11, color: 'var(--ink-2)' }}>{value}</span>
                    </div>
                  );
                })}
              </div>

              {candidates.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {candidates.map((c, i) => {
                    const meta = ACTION_META[c.action] ?? { label: c.action, color: 'var(--ink-2)', icon: '•' };
                    return (
                      <div key={i} className="chip" style={{ borderColor: 'color-mix(in srgb, ' + meta.color + ' 55%, transparent)', color: meta.color }}>
                        {meta.icon} {meta.label}
                        <span style={{ color: 'var(--ink-3)', fontSize: 10.5 }}> — {c.reason}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
