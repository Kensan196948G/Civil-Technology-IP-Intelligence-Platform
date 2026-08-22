import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

const KIND_LABEL: Record<string, string> = {
  investigation: '調査レポート', 'tech-survey': '技術調査報告書', 'patent-survey': '特許調査報告書',
  'prior-art': '先行技術調査書', 'claim-compare': 'Claim比較レポート', novelty: '新規性レビュー',
  'inventive-step': '進歩性レビュー', 'ai-examine': 'AI模擬審査報告', competitor: '競合分析',
  landscape: 'Patent Landscape', whitespace: 'ホワイトスペース分析', 'field-application': '現場適用性評価',
  rnd: 'R&D提案', licensing: 'ライセンス評価', executive: '経営サマリー'
};

export default async function ReportsPage({ searchParams }: { searchParams: { kind?: string } }) {
  const db = getDb(getDatabaseUrl());
  const kind = searchParams.kind;
  const all = await db.select().from(s.reports).orderBy(desc(s.reports.createdAt));
  const rows = kind ? all.filter(r => r.kind === kind) : all;

  const creatorIds = [...new Set(rows.map(r => r.createdBy))];
  const creators = creatorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, creatorIds)) : [];
  const creatorById = new Map(creators.map(u => [u.id, u]));

  return (
    <ListView
      title={kind ? `レポート — ${KIND_LABEL[kind] ?? kind}` : 'レポート出力履歴'}
      moduleCode="S-23 / REPORT OUTPUT"
      description="出力済みレポートの一覧です。種別ごとの絞り込みはサイドバーの各メニューから行えます。"
      rows={rows}
      emptyMessage={kind
        ? `該当種別（${KIND_LABEL[kind] ?? kind}）のレポートはまだありません。「レポート作成」から作成できます。`
        : 'レポートはまだありません。「レポート作成」から作成できます。'}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'kind', render: row => KIND_LABEL[row.kind] ?? row.kind },
        { key: 'format', mono: true, render: row => row.format.toUpperCase() },
        { key: 'creator', render: row => creatorById.get(row.createdBy)?.displayName ?? '—' },
        { key: 'createdAt', mono: true, render: row => String(row.createdAt).slice(0, 10) }
      ]}
    />
  );
}
