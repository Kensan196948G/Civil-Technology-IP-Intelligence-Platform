export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type Row = { id: string; name: string; kind: string; classification: string; field_n: number; license_n: number };

const CLASS_WEIGHT: Record<string, number> = { C1: 1, C2: 2, C3: 3, C4: 4 };

function priorityOf(score: number): { label: string; color: string } {
  if (score >= 6) return { label: '高', color: 'var(--brick)' };
  if (score >= 3) return { label: '中', color: 'var(--amber)' };
  return { label: '低', color: 'var(--ink-2)' };
}

// 維持優先度 = 活用実績（現場適用件数×2 + ライセンス化件数×3）+ 機密区分の重み。
// 実績が多く／機密度が高い技術ほど、権利維持（費用投下）の優先度が高いという考え方の
// 簡易スコアリング（本番設計ではコスト対効果モデルへ拡張予定）。
// CodeRabbit指摘: 見送り・評価中のライセンス案件がスコアへ加算されないよう、
// 契約済み（agreed）の案件のみをライセンス化実績として数える。
export default async function PortfolioPriorityPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select t.id, t.name, t.kind, t.classification,
      count(distinct fa.id) as field_n,
      count(distinct l.id) as license_n
    from technologies t
    left join field_applications fa on fa.candidate_type = 'technology' and fa.candidate_id = t.id
    left join licenses l on l.subject_type = 'technology' and l.subject_id = t.id and l.status = 'agreed'
    group by t.id, t.name, t.kind, t.classification
  `);
  const rows = (result.rows as unknown as Row[])
    .map(r => ({ ...r, score: Number(r.field_n) * 2 + Number(r.license_n) * 3 + (CLASS_WEIGHT[r.classification] ?? 0) }))
    .sort((a, b) => b.score - a.score);

  return (
    <ListView
      title="維持優先度"
      moduleCode="S-11o / LICENSING & IP PORTFOLIO"
      description="自社技術資産を、活用実績（現場適用・ライセンス化件数）と機密区分から算出した簡易スコアで優先度順に並べます。権利維持コストの配分検討に用います。"
      badge="MVP参考値"
      rows={rows}
      emptyMessage="優先度算出の対象となる自社技術資産がまだありません。"
      fields={[
        { key: 'priority', render: row => {
          const p = priorityOf(row.score);
          return <span className="badge" style={{ color: p.color, border: `1px solid ${p.color}` }}>優先度：{p.label}</span>;
        } },
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'classification', mono: true, render: row => row.classification },
        { key: 'detail', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>現場適用 {row.field_n} 件 ｜ ライセンス化 {row.license_n} 件</span> },
        { key: 'score', mono: true, render: row => `score ${row.score}` }
      ]}
    />
  );
}
