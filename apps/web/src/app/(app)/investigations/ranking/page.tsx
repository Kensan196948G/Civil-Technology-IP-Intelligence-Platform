import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { ListView } from '@/components/ListView';
import { resolveCitationLabels } from '@/lib/citations';


export default async function RankingPage() {
  const db = getDb(getDatabaseUrl());
  const citations = await db.select().from(s.aiCitations);

  // AI実行の根拠引用（ai_citations）における被引用回数を集計し、
  // 複数の調査・分析で参照されている「重要文献」として順位付けする。
  const counts = new Map<string, { sourceType: string; sourceId: string; count: number }>();
  for (const c of citations) {
    const key = `${c.sourceType}:${c.sourceId}`;
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { sourceType: c.sourceType, sourceId: c.sourceId, count: 1 });
  }

  const representative = [...counts.entries()].map(([key, v]) => ({ id: key, sourceType: v.sourceType, sourceId: v.sourceId }));
  const labels = await resolveCitationLabels(db, representative);

  const rows = [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([key, v], i) => ({
      id: key, rank: i + 1, sourceType: v.sourceType, sourceId: v.sourceId, count: v.count,
      label: labels.get(key) ?? '—'
    }));

  return (
    <ListView
      title="重要文献ランキング"
      moduleCode="S-04f / CITATION RANKING"
      description="AI実行から根拠として引用された回数の多い順の文献ランキングです。件数が多いほど、複数の調査・分析で参照されている重要文献であることを示します。"
      rows={rows}
      emptyMessage="ランキングを作成できる引用データがまだありません。"
      rowHref={row => row.sourceType === 'patent' ? `/patents/${row.sourceId}` : row.sourceType === 'netis' ? `/netis/${row.sourceId}` : ''}
      fields={[
        { key: 'rank', mono: true, render: row => `#${row.rank}` },
        { key: 'label', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.label}</span> },
        { key: 'count', mono: true, render: row => `被引用 ${row.count} 件` }
      ]}
    />
  );
}
