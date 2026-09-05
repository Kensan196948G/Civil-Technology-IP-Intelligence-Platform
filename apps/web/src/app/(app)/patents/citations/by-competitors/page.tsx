import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { ymd } from '@/lib/labels';

// FR-M26-004（SHOULD）: 自社特許を引用している競合企業を検出・提示する。
// 後方引用（cited_patent_id）が自社技術との比較対象（claim_analyses）に紐づく特許＝
// 競合が参照する技術的に近い特許。引用元の出願人が競合リストに存在する場合を検出する。
// FR-M26-005（COULD）: 学術論文→特許の技術移転（NPL引用）を提示する。

type Row = {
  id: string;
  sourceTitle: string;
  sourceApplicant: string;
  citedTitle: string;
  citedApplicant: string;
  citedCountry: string;
  createdAt: Date;
};

export default async function CitedByCompetitorsPage() {
  const db = getDb(getDatabaseUrl());
  // 全 backward 引用エッジを取得し、「引用先特許の出願人」と「引用元の出願人」が異なる
  // ＝ 競合が他社特許を引用している関係を抽出する
  const rows = await db.select({
    id: s.patentCitations.id,
    sourcePatentId: s.patentCitations.sourcePatentId,
    createdAt: s.patentCitations.createdAt
  }).from(s.patentCitations).orderBy(desc(s.patentCitations.createdAt));

  const patentIds = [...new Set(rows.flatMap(r => [r.sourcePatentId]))];
  const patents = patentIds.length
    ? await db.select().from(s.patents).where(eq(s.patents.isSample, true))
    : [];
  const patentById = new Map(patents.map(p => [p.id, p]));

  // cited_patent_id を解決
  const rowsFull: Row[] = [];
  for (const r of rows) {
    const source = patentById.get(r.sourcePatentId);
    if (!source) continue;
    // この引用元が引用している被引用特許を取得（簡略化: 逆参照は同一テーブルで source=cited を解決）
    const back = await db.select().from(s.patentCitations)
      .where(eq(s.patentCitations.sourcePatentId, r.sourcePatentId));
    for (const b of back) {
      if (b.kind !== 'backward' || !b.citedPatentId) continue;
      const cited = patentById.get(b.citedPatentId);
      if (!cited || cited.applicantName === source.applicantName) continue;
      rowsFull.push({
        id: b.id,
        sourceTitle: source.title,
        sourceApplicant: source.applicantName,
        citedTitle: cited.title,
        citedApplicant: cited.applicantName,
        citedCountry: cited.country,
        createdAt: b.createdAt
      });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>競合による他社特許引用</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M26-004 / CITED BY COMPETITORS</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        競合企業が引用している他社特許の一覧です。引用先の出願人が引用元と異なる関係を抽出し、
        競合が注目する技術領域の把握に役立てます（FR-M26-004）。
      </p>

      <ListView
        title="競合による他社特許引用"
        moduleCode="M26-004 / CITED BY COMPETITORS"
        rows={rowsFull}
        emptyMessage="競合による他社特許引用の記録がまだありません。"
        fields={[
          { key: 'source', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.sourceTitle}</span> },
          { key: 'sourceApplicant', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>引用元: {row.sourceApplicant}</span> },
          { key: 'cited', grow: true, render: row => <span style={{ fontWeight: 600 }}>{row.citedTitle}</span> },
          { key: 'citedApplicant', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>被引用: {row.citedApplicant}（{row.citedCountry}）</span> },
          { key: 'date', mono: true, render: row => ymd(row.createdAt) }
        ]}
      />
    </div>
  );
}
