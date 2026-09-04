import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { ymd } from '@/lib/labels';

// M28 FTO / Clearance Intelligence — Freedom to Operate 予備調査の案件一覧。
// 要件: docs/90-project/06-first-wave-fr-drafts.md（FR-M28-001〜006）
// 原則: AIは侵害と判定しない。最終判断は人間レビュー → Construction-LegalOps-DX → 法務・弁理士。

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: '下書き', color: 'var(--ink-3)' },
  in_review: { label: '調査・照合中', color: 'var(--blue)' },
  completed: { label: '照合完了', color: '#1e7d46' },
  closed: { label: 'クローズ', color: 'var(--ink-3)' }
};

export default async function FtoListPage() {
  const db = getDb(getDatabaseUrl());
  const cases = await db.select().from(s.ftoCases).orderBy(desc(s.ftoCases.createdAt));

  const caseIds = cases.map(c => c.id);
  const components = caseIds.length
    ? await db.select().from(s.ftoComponents).where(inArray(s.ftoComponents.ftoCaseId, caseIds))
    : [];

  const byCase = new Map<string, typeof components>();
  for (const c of components) {
    const list = byCase.get(c.ftoCaseId) ?? [];
    list.push(c);
    byCase.set(c.ftoCaseId, list);
  }

  const rows = cases.map(c => {
    const comps = byCase.get(c.id) ?? [];
    return {
      id: c.id,
      title: c.title,
      description: c.description ?? '—',
      status: c.status,
      total: comps.length,
      mustReview: comps.filter(x => x.actionLevel === 'must_review').length,
      createdAt: c.createdAt
    };
  });

  return (
    <ListView
      title="FTO予備調査"
      moduleCode="M28 / FTO & CLEARANCE"
      description="新たな施工装置・工法の技術構成要素ごとに、他社特許の Claim を照合した Freedom to Operate 予備調査です。"
      badge="第一拡張群"
      rows={rows}
      emptyMessage="FTO予備調査の案件はまだありません。"
      rowHref={row => `/fto/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontWeight: 700 }}>{row.title}</span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{row.description.length > 48 ? `${row.description.slice(0, 48)}…` : row.description}</span>
          </span>
        ) },
        { key: 'status', render: row => {
          const meta = STATUS_META[row.status] ?? { label: row.status, color: 'var(--ink-3)' };
          return <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{meta.label}</span>;
        } },
        { key: 'components', mono: true, render: row => <span style={{ fontSize: 12 }}>構成 {row.total}</span> },
        { key: 'mustReview', mono: true, render: row => row.mustReview > 0
          ? <span style={{ color: 'var(--amber)', fontWeight: 700 }}>🔴 要専門確認 {row.mustReview}</span>
          : <span style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>要確認なし</span> },
        { key: 'date', mono: true, render: row => <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{ymd(row.createdAt)}</span> }
      ]}
    />
  );
}
