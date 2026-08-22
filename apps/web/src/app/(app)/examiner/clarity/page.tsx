import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

function trunc(text: string, n: number) {
  return text.length > n ? text.slice(0, n) + '…' : text;
}

// 明確性（特許法36条6項2号相当）の簡易AI判定。
// 「等」「など」等の曖昧な限定表現を含む場合、または文長が長すぎる場合に要確認とする。
const AMBIGUOUS_RE = /等|など|程度|適宜|必要に応じ/;

function clarityVerdict(text: string): { label: string; color: string } {
  if (AMBIGUOUS_RE.test(text)) return { label: '曖昧表現の懸念', color: 'var(--brick)' };
  if (text.length > 120) return { label: '長文・要確認', color: 'var(--amber)' };
  return { label: '明確（AI簡易判定）', color: 'var(--green)' };
}

export default async function ClarityReviewPage() {
  const db = getDb(getDatabaseUrl());

  const claims = await db.select().from(s.patentClaims).orderBy(asc(s.patentClaims.claimNo));
  const patentIds = [...new Set(claims.map(c => c.patentId))];
  const patents = patentIds.length
    ? await db.select().from(s.patents).where(inArray(s.patents.id, patentIds))
    : [];
  const patentById = new Map(patents.map(p => [p.id, p]));

  return (
    <ListView
      title="明確性レビュー"
      moduleCode="S-14 / AI PATENT REVIEW"
      description="請求項の記載文言について、曖昧な限定表現や文長の観点からAIが明確性（特許法36条6項2号相当）を簡易判定した一覧です。"
      badge="MVP"
      rows={claims}
      emptyMessage="明確性レビュー対象の請求項データがまだありません。"
      rowHref={row => `/patents/${row.patentId}`}
      fields={[
        { key: 'patent', grow: true, render: row => patentById.get(row.patentId)?.title ?? '（対象特許不明）' },
        { key: 'claimNo', mono: true, render: row => `請求項${row.claimNo}` },
        { key: 'indep', render: row => row.isIndependent ? '独立項' : '従属項' },
        { key: 'text', render: row => trunc(row.text, 30) },
        { key: 'verdict', render: row => {
          const v = clarityVerdict(row.text);
          return <span className="badge" style={{ color: v.color, border: `1px solid ${v.color}` }}>{v.label}</span>;
        } }
      ]}
    />
  );
}
