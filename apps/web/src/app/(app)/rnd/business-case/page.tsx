import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { Meter } from '@/components/ui';

// M37 Technology Business Case Intelligence — 技術導入の費用対効果を可視化する。
// 導入費・年間削減額・削減工数・ROI・TCO・Payback。M32 IP Value とセットで経営判断を支援。

const yen = (v: number | null) => v === null ? '—' : `${(v / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 0 })} 万円`;

export default async function BusinessCasePage() {
  const db = getDb(getDatabaseUrl());
  const cases = await db.select().from(s.businessCases).orderBy(desc(s.businessCases.roiPct));
  const techIds = [...new Set(cases.map(c => c.technologyId))];
  const techList = techIds.length
    ? await db.select().from(s.technologies).where(inArray(s.technologies.id, techIds))
    : [];
  const techById = new Map(techList.map(t => [t.id, t]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>Business Case（費用対効果）</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M37 / BUSINESS CASE</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第二拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        技術導入の費用対効果（導入費・年間削減額・削減工数・ROI・TCO・Payback）を技術ごとに整理します。
        M32 IP Value（権利としての価値）と合わせて経営判断の材料にします。
      </p>

      {cases.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          Business Case がまだ登録されていません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cases.map(c => {
          const tech = techById.get(c.technologyId);
          const roi = c.roiPct === null ? null : Number(c.roiPct);
          const payback = c.paybackYears === null ? null : Number(c.paybackYears);
          const roiColor = roi === null ? 'var(--ink-2)' : roi >= 50 ? 'var(--green)' : roi >= 0 ? 'var(--amber)' : 'var(--brick)';
          return (
            <div key={c.id} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 14.5 }}>{tech?.name ?? '技術（削除済み）'}</span>
                {roi !== null && (
                  <span className="mono" style={{ fontSize: 22, color: roiColor }}>{roi.toFixed(1)}%</span>
                )}
                <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>ROI（5年償却ベース）</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                {[
                  { label: '導入費', value: yen(c.capexYen) },
                  { label: '年間削減額', value: yen(c.annualSavingsYen) },
                  { label: '年間削減工数', value: c.laborHoursSavedPerYear === null ? '—' : `${c.laborHoursSavedPerYear} h` },
                  { label: '5年TCO', value: yen(c.tco5yYen) },
                  { label: 'Payback', value: payback === null ? '—' : `${payback.toFixed(1)} 年` }
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{item.label}</span>
                    <span className="mono" style={{ fontSize: 13.5, fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>

              {c.baselineMethod && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                  Before（従来工法）: {c.baselineMethod}
                </div>
              )}

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
