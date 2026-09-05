import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/current-user';
import { redirect } from 'next/navigation';

// M38 Safety & Quality Intelligence — 新技術の現場導入前に、安全・品質リスク候補を
// 類似事故・不具合事例・安全基準・NETIS評価等から集めて提示する安全ゲート。
// 要件: FR-M38-001〜004（docs/90-project/06-first-wave-fr-drafts.md）
// 原則: 各リスク候補には必ず出典を添付する（FR-M38-003）。導入可否の最終判断は安全・品質担当者
// （本画面はゲートであり、AI・本システムが「導入可」と決定することはない。FR-M38-004）。
// #11: 技術台帳（C2）ベースのため C3 は対象外だが、将来 C3 化に備え可視条件を適用する。

const GATE_META: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: '未着手', color: 'var(--ink-2)', icon: '⏳' },
  in_review: { label: '審査中', color: 'var(--amber)', icon: '🔍' },
  cleared: { label: '通過（安全ゲートOK）', color: 'var(--green)', icon: '✅' },
  blocked: { label: '保留（要対策）', color: 'var(--brick)', icon: '⛔' }
};

const RISK_LEVEL: Record<string, { label: string; color: string }> = {
  high: { label: '高', color: 'var(--brick)' },
  medium: { label: '中', color: 'var(--amber)' },
  low: { label: '低', color: 'var(--green)' }
};

type Risk = { type: string; detail: string; source: string; level: string };

export default async function SafetyGatePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb(getDatabaseUrl());

  const all = await db.select().from(s.safetyReviews)
    .orderBy(desc(s.safetyReviews.createdAt));
  const techIds = [...new Set(all.map(r => r.technologyId))];
  const techs = techIds.length
    ? await db.select().from(s.technologies).where(inArray(s.technologies.id, techIds))
    : [];
  const techById = new Map(techs.map(t => [t.id, t]));

  // #11: safety_reviews は技術（C2）に紐づくため全ロール可視。
  // 将来 C2 以上の分類を持つ場合、safety_reviews に classification を設けて visibleWhere を適用する。
  const rows = all.map(r => ({
    id: r.id,
    techId: r.technologyId,
    techName: techById.get(r.technologyId)?.name ?? '技術（削除済み）',
    risks: (r.risks ?? []) as Risk[],
    gateStatus: r.gateStatus,
    gateComment: r.gateComment,
    createdAt: r.createdAt
  }));

  const countBy = (st: string) => rows.filter(r => r.gateStatus === st).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>安全・品質ゲート</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M38 / SAFETY & QUALITY</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第一拡張群</span>
      </div>
      <div className="notice notice-brick" style={{ fontSize: 12 }}>
        <strong>導入可否の最終判断は、安全・品質担当者が行います。</strong>
        ここに表示するリスク候補は、類似事故・不具合事例・安全基準・NETIS評価・論文からの「要確認ポイント」です。
        各リスクには必ず出典を添付しています（FR-M38-003）。AI は「導入可／不可」を決定しません。
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {Object.entries(GATE_META).map(([k, meta]) => (
          <div key={k} className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ fontSize: 13 }}>{meta.icon}</span>
            <span className="mono" style={{ fontSize: 20, color: meta.color }}>{countBy(k)}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{meta.label}</span>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          安全ゲートの対象となる技術がまだ登録されていません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(r => {
          const gate = GATE_META[r.gateStatus] ?? { label: r.gateStatus, color: 'var(--ink-2)', icon: '•' };
          return (
            <div key={r.id} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 14.5 }}>{r.techName}</span>
                <span className="badge" style={{ color: gate.color, border: `1px solid ${gate.color}` }}>{gate.icon} {gate.label}</span>
              </div>

              {/* リスク候補（出典付き） */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {r.risks.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>リスク候補はありません。</div>
                )}
                {r.risks.map((risk, i) => {
                  const lv = RISK_LEVEL[risk.level] ?? { label: risk.level, color: 'var(--ink-2)' };
                  return (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span className="badge" style={{ color: lv.color, border: `1px solid ${lv.color}`, flex: 'none', fontSize: 10 }}>リスク{lv.label}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{risk.type}</span>
                        <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{risk.detail}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>出典: {risk.source}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {r.gateComment && (
                <div style={{ fontSize: 12, color: 'var(--ink-2)', borderTop: '1px solid var(--line-2)', paddingTop: 8 }}>
                  ゲートコメント: {r.gateComment}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
