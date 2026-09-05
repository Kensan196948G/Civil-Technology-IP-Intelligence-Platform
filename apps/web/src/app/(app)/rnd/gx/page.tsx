import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { Meter } from '@/components/ui';

// M39 GX / Environmental Intelligence — 従来工法と新技術の環境負荷比較を可視化する。
// CO2・燃料・資材・廃棄物・省人化の削減率を定量化し、GX推進の判断材料にする。

const pct = (v: string | number | null | undefined) => (v === null || v === undefined) ? null : Number(v);

const AXES: Array<{ key: string; label: string; color: string }> = [
  { key: 'co2_reduction_pct', label: 'CO₂削減率', color: 'var(--green)' },
  { key: 'fuel_savings_pct', label: '燃料削減率', color: 'var(--blue)' },
  { key: 'material_savings_pct', label: '資材削減率', color: '#7c5cbf' },
  { key: 'waste_reduction_pct', label: '廃棄物削減率', color: 'var(--amber)' },
  { key: 'labor_reduction_pct', label: '省人化', color: '#1e7d46' }
];

export default async function GxPage() {
  const db = getDb(getDatabaseUrl());
  const comparisons = await db.select().from(s.gxComparisons)
    .orderBy(desc(s.gxComparisons.co2ReductionTonPerYear));
  const techIds = [...new Set(comparisons.map(c => c.technologyId))];
  const techList = techIds.length
    ? await db.select().from(s.technologies).where(inArray(s.technologies.id, techIds))
    : [];
  const techById = new Map(techList.map(t => [t.id, t]));

  const totalCo2 = comparisons.reduce((sum, c) => sum + (pct(c.co2ReductionTonPerYear) ?? 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>GX・環境負荷比較</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M39 / GX INTELLIGENCE</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第二拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        従来工法と新技術を CO₂・燃料・資材・廃棄物・省人化の観点で定量化比較します。
        経営の GX（グリーントランスフォーメーション）推進・施工計画の環境配慮の判断材料です。
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 22, color: 'var(--green)' }}>{totalCo2.toFixed(1)}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>CO₂ 削減量合計（t/年・デモ）</span>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 22, color: 'var(--blue)' }}>{comparisons.length}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>比較対象技術</span>
        </div>
      </div>

      {comparisons.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          GX 比較データがまだ登録されていません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {comparisons.map(c => {
          const tech = techById.get(c.technologyId);
          return (
            <div key={c.id} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 14.5 }}>{tech?.name ?? '技術（削除済み）'}</span>
                {c.co2ReductionTonPerYear !== null && (
                  <span className="mono" style={{ fontSize: 18, color: 'var(--green)' }}>
                    −{Number(c.co2ReductionTonPerYear).toFixed(1)} t CO₂/年
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                Before（従来工法）: {c.baselineMethod}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                {AXES.map(ax => {
                  const v = pct((c as unknown as Record<string, unknown>)[ax.key] as number);
                  if (v === null) return null;
                  return (
                    <div key={ax.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{ax.label}</span>
                        <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: ax.color, marginLeft: 'auto' }}>−{v.toFixed(0)}%</span>
                      </div>
                      <Meter value={v} color={ax.color} height={5} />
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Object.entries((c.basis ?? {}) as Record<string, string>).map(([k, v]) => (
                  <span key={k}>・{v}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
