export const runtime = 'edge';
import { ListView } from '@/components/ListView';
import { loadFieldAxisRows } from '../_lib';


export default async function FieldAxisProductivityPage() {
  const rows = await loadFieldAxisRows(['生産性・省人化評価', '生産性', '省人化']);

  return (
    <ListView
      title="現場適用性評価 — 生産性・省人化評価"
      moduleCode="S-19 / FIELD APPLICATION AXIS"
      description="現場適用性スコアのうち「生産性・省人化評価」軸の評価内訳です。各行から現場適用性評価の詳細（全軸の内訳）を確認できます。"
      rows={rows}
      emptyMessage="「生産性・省人化評価」軸の評価データはまだありません。現場・課題ページから困りごとを登録すると、AIが候補技術と軸別スコアを提案します。"
      rowHref={row => `/field/${row.fieldApplicationId}`}
      fields={[
        { key: 'site', render: row => <span style={{ fontWeight: 700 }}>{row.siteName}</span> },
        { key: 'candidate', grow: true, render: row => (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>{row.candidateName}</span>
            {row.axisBasis && <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{row.axisBasis}</span>}
          </span>
        ) },
        { key: 'value', mono: true, render: row => `評価値 ${row.axisValue.toFixed(2)}` },
        { key: 'weight', render: row => `重み${row.axisWeight}` },
        { key: 'estimated', render: row => row.axisIsEstimated ? (
          <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>AI推定</span>
        ) : (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>規則</span>
        ) },
        { key: 'score', mono: true, render: row => `総合${row.score.toFixed(0)}/100` }
      ]}
    />
  );
}
