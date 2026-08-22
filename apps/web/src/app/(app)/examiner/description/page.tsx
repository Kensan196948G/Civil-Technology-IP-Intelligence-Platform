import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

function verdict(hasAbstract: boolean, claimCount: number): { label: string; color: string } {
  if (claimCount === 0) return { label: '要件不足の懸念（請求項なし）', color: 'var(--brick)' };
  if (!hasAbstract) return { label: '要確認（要約なし）', color: 'var(--amber)' };
  return { label: '記載要件 充足（AI簡易判定）', color: 'var(--green)' };
}

export default async function DescriptionReviewPage() {
  const db = getDb(getDatabaseUrl());

  const patents = await db.select().from(s.patents).orderBy(desc(s.patents.retrievedAt));
  const patentIds = patents.map(p => p.id);
  const claims = patentIds.length
    ? await db.select().from(s.patentClaims).where(inArray(s.patentClaims.patentId, patentIds))
    : [];
  const claimCountByPatent = new Map<string, number>();
  for (const c of claims) claimCountByPatent.set(c.patentId, (claimCountByPatent.get(c.patentId) ?? 0) + 1);

  return (
    <ListView
      title="記載要件レビュー"
      moduleCode="S-14 / AI PATENT REVIEW"
      description="特許明細書の要約・請求項の記載状況から、記載要件（特許法36条相当）の充足度をAIが簡易判定した一覧です。"
      badge="MVP"
      rows={patents}
      emptyMessage="記載要件レビュー対象の特許データがまだありません。"
      rowHref={row => `/patents/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'applicant', render: row => row.applicantName },
        { key: 'claims', mono: true, render: row => `請求項 ${claimCountByPatent.get(row.id) ?? 0} 件` },
        { key: 'abstract', render: row => row.abstract ? '要約あり' : '要約なし' },
        { key: 'verdict', render: row => {
          const v = verdict(!!row.abstract, claimCountByPatent.get(row.id) ?? 0);
          return <span className="badge" style={{ color: v.color, border: `1px solid ${v.color}` }}>{v.label}</span>;
        } }
      ]}
    />
  );
}
