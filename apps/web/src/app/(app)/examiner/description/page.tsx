import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

// CodeRabbit指摘: 要約有無・請求項数だけでは特許法36条（記載要件）の充足を
// 確定できない。「充足」という確定的な法的結論ではなく、形式データの有無を
// 示す書式チェック結果として表示する（最終判断は専門家が行う）。
function verdict(hasAbstract: boolean, claimCount: number): { label: string; color: string } {
  if (claimCount === 0) return { label: '請求項未登録（要確認）', color: 'var(--brick)' };
  if (!hasAbstract) return { label: '要約未登録（要確認）', color: 'var(--amber)' };
  return { label: '要約・請求項とも登録済み', color: 'var(--blue)' };
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
      description="特許明細書の要約・請求項が登録されているかを機械的に確認した一覧です。特許法36条の記載要件充足を確定するものではなく、専門家によるレビューの要否を絞り込むための書式チェックです。"
      badge="書式チェック"
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
