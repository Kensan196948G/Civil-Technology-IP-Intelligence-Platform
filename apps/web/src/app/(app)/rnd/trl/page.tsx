import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { Meter } from '@/components/ui';

// M35 Technology Readiness Intelligence — 技術の成熟度（TRL 1-9）と判定根拠を可視化する。
// 現場導入の判断材料。M03-004 / technologies.maturity の定量化。

const TRL_COLOR = (trl: number) => trl >= 8 ? 'var(--green)' : trl >= 6 ? 'var(--blue)' : trl >= 4 ? 'var(--amber)' : 'var(--brick)';

export default async function TrlPage() {
  const db = getDb(getDatabaseUrl());
  const assessments = await db.select().from(s.trlAssessments).orderBy(desc(s.trlAssessments.trl));
  const techIds = [...new Set(assessments.map(a => a.technologyId))];
  const techList = techIds.length
    ? await db.select().from(s.technologies).where(inArray(s.technologies.id, techIds))
    : [];
  const techById = new Map(techList.map(t => [t.id, t]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>技術成熟度（TRL）</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M35 / READINESS</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第二拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        自社技術の成熟度を TRL（Technology Readiness Level 1〜9）で定量化し、判定根拠（PoC・施工実績・評価）と
        次段階へのステップを併記します。現場導入判断・研究投資判断の材料です。
      </p>

      {assessments.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          TRL 評価がまだ登録されていません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {assessments.map(a => {
          const tech = techById.get(a.technologyId);
          const evidence = (a.evidence ?? []) as string[];
          return (
            <div key={a.id} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 14.5 }}>{tech?.name ?? '技術（削除済み）'}</span>
                <span className="badge" style={{ color: TRL_COLOR(a.trl), border: `1px solid ${TRL_COLOR(a.trl)}` }}>
                  TRL {a.trl}／{a.levelLabel}
                </span>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>評価日 {a.assessedOn}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flexGrow: 1 }}><Meter value={(a.trl / 9) * 100} color={TRL_COLOR(a.trl)} height={8} /></span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', width: 50, textAlign: 'right' }}>{a.trl} / 9</span>
              </div>
              {evidence.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 8, borderLeft: '2px solid var(--line)' }}>
                  {evidence.map((e, i) => (
                    <span key={i} style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>・{e}</span>
                  ))}
                </div>
              )}
              {a.nextStep && <div style={{ fontSize: 12 }}>次段階へ: {a.nextStep}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
