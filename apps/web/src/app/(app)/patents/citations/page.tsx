import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { ymd } from '@/lib/labels';

// M26 Patent Citation Intelligence — 特許間の引用関係（後方/前方）と NPL（論文等）引用。
// 要件: docs/90-project/06-first-wave-fr-drafts.md（FR-M26-001/002/006）
// 収集は MVP ではデモデータ投入のみ。実データ化は JPO/WIPO 等の API 連携（将来フェーズ）で行う。

const KIND_META: Record<string, { label: string; color: string }> = {
  backward: { label: '後方引用', color: 'var(--blue)' },
  forward: { label: '前方引用', color: '#1e7d46' },
  npl: { label: 'NPL引用', color: '#b7791f' }
};

export default async function PatentCitationsPage() {
  const db = getDb(getDatabaseUrl());
  const citations = await db.select().from(s.patentCitations).orderBy(desc(s.patentCitations.createdAt));

  const sourceIds = [...new Set(citations.map(c => c.sourcePatentId))];
  const patentIds = [...new Set([...sourceIds, ...citations.filter(c => c.citedPatentId).map(c => c.citedPatentId as string)])];
  const paperIds = [...new Set(citations.filter(c => c.citedPaperId).map(c => c.citedPaperId as string))];

  const patents = patentIds.length ? await db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : [];
  const papers = paperIds.length ? await db.select().from(s.papers).where(inArray(s.papers.id, paperIds)) : [];
  const patentById = new Map(patents.map(p => [p.id, p]));
  const paperById = new Map(papers.map(p => [p.id, p]));

  const summary = {
    total: citations.length,
    backward: citations.filter(c => c.kind === 'backward').length,
    forward: citations.filter(c => c.kind === 'forward').length,
    npl: citations.filter(c => c.kind === 'npl').length
  };

  const rows = citations.map(c => {
    const citedPatent = c.citedPatentId ? patentById.get(c.citedPatentId) : undefined;
    const citedPaper = c.citedPaperId ? paperById.get(c.citedPaperId) : undefined;
    return {
      id: c.id,
      sourceTitle: patentById.get(c.sourcePatentId)?.title ?? '特許（削除済み）',
      kind: c.kind,
      targetLabel: citedPatent?.title ?? citedPaper?.title ?? '引用先不明',
      targetType: citedPatent ? 'patent' : 'paper',
      targetId: citedPatent?.id ?? citedPaper?.id,
      note: c.note ?? '—',
      createdAt: c.createdAt
    };
  });

  const statChips = [
    { label: '引用エッジ合計', n: summary.total },
    { label: '後方引用', n: summary.backward },
    { label: '前方引用', n: summary.forward },
    { label: 'NPL引用', n: summary.npl }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {statChips.map(chip => (
          <div key={chip.label} className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span className="mono" style={{ fontSize: 20, color: 'var(--blue)' }}>{chip.n}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{chip.label}</span>
          </div>
        ))}
      </div>
      <ListView
        title="特許引用ネットワーク"
        moduleCode="M26 / CITATION INTELLIGENCE"
        description="どの特許がどの特許・論文を引用しているか（技術系譜）を一覧します。引用関係はデモデータ投入によるもの。実データ化は JPO/WIPO 等の API 連携で行う（FR-M26-006）。"
        badge="第一拡張群"
        rows={rows}
        emptyMessage="特許引用の記録がまだありません。"
        rowHref={row => row.targetType === 'patent' && row.targetId ? `/patents/${row.targetId}` : ''}
        fields={[
          { key: 'source', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.sourceTitle}</span> },
          { key: 'kind', render: row => {
            const meta = KIND_META[row.kind] ?? { label: row.kind, color: 'var(--ink-3)' };
            return <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{meta.label}</span>;
          } },
          { key: 'target', grow: true, render: row => (
            <span style={{ fontSize: 12.5, color: row.targetType === 'paper' ? 'var(--ink-3)' : 'var(--ink)' }}>
              {row.targetType === 'paper' ? '📄 ' : '📜 '}{row.targetLabel}
            </span>
          ) },
          { key: 'note', render: row => <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{row.note}</span> },
          { key: 'date', mono: true, render: row => <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{ymd(row.createdAt)}</span> }
        ]}
      />
    </div>
  );
}
