import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { count, sql } from 'drizzle-orm';
import { InfoPage, type InfoBlock } from '@/components/InfoPage';

export const runtime = 'edge';

const KIND_LABEL: Record<string, string> = {
  technology: '技術（technology）', method: '工法（method）', material: '材料（material）', machine: '機械（machine）'
};

export default async function TechMapPage() {
  const db = getDb(getDatabaseUrl());
  const [total] = await db.select({ n: count() }).from(s.technologies);

  const kindCountsResult = await db.execute(sql`
    select kind, count(*)::int as n from technologies group by kind order by n desc
  `);
  const kindCounts = kindCountsResult.rows as { kind: string; n: number }[];

  const workTypeResult = await db.execute(sql`
    select unnest(work_types) as wt, count(*)::int as n from technologies group by wt order by n desc limit 10
  `);
  const workTypes = workTypeResult.rows as { wt: string; n: number }[];

  const blocks: InfoBlock[] = [
    { label: '保有・調査技術の総数', value: `${total?.n ?? 0} 件` },
    ...kindCounts.map(k => ({ label: `　種別：${KIND_LABEL[k.kind] ?? k.kind}`, value: `${k.n} 件` }))
  ];

  return (
    <InfoPage
      title="技術関連マップ"
      moduleCode="S-06 / TECHNOLOGY INTELLIGENCE"
      description="技術台帳を種別・関連工種で集計した俯瞰マップです。技術間の関連はまだグラフ化されておらず、集計表として表示しています。"
      badge="MVP"
      blocks={blocks}
      note="技術どうしの関連性（類似・派生・競合等）をノード・エッジで可視化するグラフ表示は本番設計フェーズのバックログです。現時点では種別・関連工種の集計のみを表示します。"
    >
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          関連工種タグ別の件数（上位10件）
        </div>
        {workTypes.length === 0 ? (
          <div style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--ink-2)' }}>
            関連工種タグが登録された技術データがまだありません。
          </div>
        ) : (
          <div>
            {workTypes.map(w => (
              <div key={w.wt} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--line-2)' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 3, padding: '1px 6px' }}>{w.wt}</span>
                <span style={{ flexGrow: 1 }} />
                <span className="mono" style={{ fontSize: 13 }}>{w.n} 件</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </InfoPage>
  );
}
