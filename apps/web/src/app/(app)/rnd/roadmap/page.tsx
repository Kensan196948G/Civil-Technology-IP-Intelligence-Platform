import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { InfoPage, type InfoBlock } from '@/components/InfoPage';

export const runtime = 'edge';

const KIND_LABEL: Record<string, string> = {
  technology: '技術', method: '工法', material: '材料', machine: '建設機械'
};

export default async function RndRoadmapPage() {
  const db = getDb(getDatabaseUrl());
  const technologies = await db.select().from(s.technologies);

  const grouped = await db.execute(sql`
    select coalesce(maturity, '未設定') as maturity, count(*)::int as n
    from technologies
    group by maturity
    order by n desc
  `);
  const blocks: InfoBlock[] = (grouped.rows as any[]).map(g => ({
    label: `成熟度：${g.maturity}`,
    value: `${g.n} テーマ`
  }));

  const byMaturity = new Map<string, typeof technologies>();
  for (const t of technologies) {
    const key = t.maturity ?? '未設定';
    const arr = byMaturity.get(key) ?? [];
    arr.push(t);
    byMaturity.set(key, arr);
  }

  return (
    <InfoPage
      title="技術ロードマップ"
      moduleCode="S-10 / TECHNOLOGY ROADMAP"
      description="自社の研究テーマを成熟度（研究・試験・実用など）別に俯瞰し、今後の技術展開を検討するための一覧です。"
      blocks={blocks}
      note="MVPでは技術マスタの成熟度区分から簡易的にロードマップを構成しています。時系列の計画・マイルストーン管理は本番設計フェーズで拡張予定です。"
    >
      {byMaturity.size === 0 ? (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)', marginTop: 16 }}>
          登録されている技術テーマはありません。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {[...byMaturity.entries()].map(([maturity, techs]) => (
            <div key={maturity} className="card" style={{ padding: 0 }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
                {maturity}
              </div>
              <div>
                {techs.map((t, i) => (
                  <div key={t.id} style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: i < techs.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)' }}>{KIND_LABEL[t.kind] ?? t.kind}</span>
                    <span style={{ flexGrow: 1 }} />
                    <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{t.classification}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </InfoPage>
  );
}
