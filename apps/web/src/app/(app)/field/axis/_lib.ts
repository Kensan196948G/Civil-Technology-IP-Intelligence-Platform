// 08. 土木技術・現場適用 / 現場適用性スコアの軸別内訳（field/axis）ページ共通クエリ。
// このファイルは page.tsx ではないため Next.js のルートにはならない（内部ヘルパー）。
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { sql, inArray } from 'drizzle-orm';

export type FieldAxisRow = {
  id: string;
  fieldApplicationId: string;
  siteName: string;
  candidateName: string;
  score: number;
  axisName: string;
  axisValue: number;
  axisWeight: number;
  axisBasis: string;
  axisIsEstimated: boolean;
};

type AxisSqlRow = {
  fa_id: string;
  site_issue_id: string;
  candidate_type: string;
  candidate_id: string;
  score: string;
  axis_name: string;
  axis_value: string;
  axis_weight: string;
  axis_basis: string | null;
  axis_is_estimated: boolean;
};

// field_applications.axes（jsonb配列）を展開し、軸名が keywords のいずれかに一致する
// 内訳行のみを抽出する。既存の /field/[id] 詳細ページと同じ axes 構造を前提とする。
export async function loadFieldAxisRows(keywords: string[]): Promise<FieldAxisRow[]> {
  const db = getDb(getDatabaseUrl());
  const nameConditions = keywords.map(k => sql`elem->>'axis' = ${k}`);
  const nameMatch = sql.join(nameConditions, sql` OR `);

  const result = await db.execute(sql`
    select
      fa.id as fa_id, fa.site_issue_id, fa.candidate_type, fa.candidate_id, fa.score,
      elem->>'axis' as axis_name,
      (elem->>'value')::numeric as axis_value,
      (elem->>'weight')::numeric as axis_weight,
      elem->>'basis' as axis_basis,
      coalesce((elem->>'is_estimated')::boolean, false) as axis_is_estimated
    from field_applications fa,
      jsonb_array_elements(fa.axes) as elem
    where ${nameMatch}
    order by fa.created_at desc
  `);
  const raw = result.rows as AxisSqlRow[];
  if (raw.length === 0) return [];

  const issueIds = [...new Set(raw.map(r => r.site_issue_id))];
  const issues = issueIds.length ? await db.select().from(s.siteIssues).where(inArray(s.siteIssues.id, issueIds)) : [];
  const siteIds = [...new Set(issues.map(i => i.siteId))];
  const sites = siteIds.length ? await db.select().from(s.sites).where(inArray(s.sites.id, siteIds)) : [];

  const techIds = [...new Set(raw.filter(r => r.candidate_type === 'technology').map(r => r.candidate_id))];
  const technologies = techIds.length ? await db.select().from(s.technologies).where(inArray(s.technologies.id, techIds)) : [];
  const netisIds = [...new Set(raw.filter(r => r.candidate_type === 'netis').map(r => r.candidate_id))];
  const netisTechs = netisIds.length ? await db.select().from(s.netisTechnologies).where(inArray(s.netisTechnologies.id, netisIds)) : [];

  const issueById = new Map(issues.map(i => [i.id, i]));
  const siteById = new Map(sites.map(sv => [sv.id, sv]));
  const techById = new Map(technologies.map(t => [t.id, t]));
  const netisById = new Map(netisTechs.map(n => [n.id, n]));

  return raw.map(r => {
    const issue = issueById.get(r.site_issue_id);
    const site = issue ? siteById.get(issue.siteId) : undefined;
    const candidateName = r.candidate_type === 'technology'
      ? techById.get(r.candidate_id)?.name
      : netisById.get(r.candidate_id)?.name;
    return {
      id: `${r.fa_id}:${r.axis_name}`,
      fieldApplicationId: r.fa_id,
      siteName: site?.name ?? '—',
      candidateName: candidateName ?? '候補技術不明',
      score: Number(r.score),
      axisName: r.axis_name,
      axisValue: Number(r.axis_value),
      axisWeight: Number(r.axis_weight),
      axisBasis: r.axis_basis ?? '',
      axisIsEstimated: !!r.axis_is_estimated
    };
  });
}
