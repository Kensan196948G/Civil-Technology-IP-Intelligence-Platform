import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { FilterChips, Notice } from '@/components/ui';

// M36 PoC / Experiment Management — 仮説→実証→結果→採用/中止の管理（第一拡張群・実装順位7）。
// 要件: docs/90-project/06-first-wave-fr-drafts.md（FR-M36-001〜005）

const RESULT_META: Record<string, { label: string; color: string }> = {
  planned: { label: '計画中', color: 'var(--ink-3)' },
  running: { label: '実証中', color: 'var(--blue)' },
  success: { label: '成功', color: '#1e7d46' },
  partial_success: { label: '部分成功', color: '#b7791f' },
  failed: { label: '失敗・未達', color: '#c0392b' },
  abandoned: { label: '中止', color: 'var(--ink-3)' }
};

function kpiSummary(kpis: unknown): string {
  if (!kpis || typeof kpis !== 'object') return '—';
  const entries = Object.entries(kpis as Record<string, unknown>).slice(0, 3);
  if (entries.length === 0) return '—';
  return entries
    .map(([k, v]) => `${k}: ${typeof v === 'number' ? (v >= 100 ? String(Math.round(v)) : String(v)) : String(v)}`)
    .join(' / ');
}

export default async function RndPocPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  // Next.js 15: searchParams は Promise
  const sp = await searchParams;
  const resultFilter = sp.result ?? '';
  const db = getDb(getDatabaseUrl());
  const experimentsAll = await db
    .select()
    .from(s.pocExperiments)
    .orderBy(desc(s.pocExperiments.createdAt));
  const experiments = resultFilter
    ? experimentsAll.filter(p => p.result === resultFilter)
    : experimentsAll;

  const rows = experiments.map(p => ({
    id: p.id,
    title: p.title,
    hypothesis: p.hypothesis ?? '—',
    kpis: kpiSummary(p.kpis),
    result: p.result,
    costYen: p.costYen,
    lesson: p.lesson ?? '—',
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '—'
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
  {resultFilter && (
    <div className="notice notice-blue" style={{ fontSize: 12 }}>
      結果「{RESULT_META[resultFilter]?.label ?? resultFilter}」でフィルタ中。失敗・中止を含む全PoCの知見を検索・再利用できます（FR-M36-005）。
      <a href="/rnd/poc" style={{ marginLeft: 8, color: 'var(--blue)' }}>フィルタ解除</a>
    </div>
  )}
  {!resultFilter && (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {Object.entries(RESULT_META).map(([key, meta]) => (
        <a key={key} href={`/rnd/poc?result=${key}`} className="chip" style={{ fontSize: 11 }}>
          {meta.label} ({experimentsAll.filter(p => p.result === key).length})
        </a>
      ))}
    </div>
  )}

    <ListView
      title="PoC実験管理"
      moduleCode="M36 / POC MANAGEMENT"
      description="現場課題 → PoC実証 → 結果 → 採用/中止 を管理します。失敗したPoCも「レッスン」として会社の資産に残します（FR-M36）。"
      badge="第一拡張群"
      rows={rows}
      emptyMessage="PoC案件はまだありません。「PoC計画」を登録するとここに表示されます。"
      fields={[
        { key: 'title', render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'hypothesis', grow: true, render: row => (
          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
            {row.hypothesis.length > 46 ? `${row.hypothesis.slice(0, 46)}…` : row.hypothesis}
          </span>
        ) },
        { key: 'kpis', render: row => <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{row.kpis}</span> },
        { key: 'result', render: row => {
          const meta = RESULT_META[row.result] ?? { label: row.result, color: 'var(--ink-3)' };
          return <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{meta.label}</span>;
        } },
        { key: 'cost', mono: true, render: row => (
          row.costYen == null ? <span style={{ color: 'var(--ink-3)' }}>—</span> : `${(row.costYen / 10000).toFixed(0)}万円`
        ) },
        { key: 'lesson', render: row => (
          <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
            {row.lesson.length > 34 ? `${row.lesson.slice(0, 34)}…` : row.lesson}
          </span>
        ) },
        { key: 'date', mono: true, render: row => <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{row.createdAt}</span> }
      ]}
      />
    </div>
  );
}
