import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

type Citation = { id: string; sourceType: string; sourceId: string };

export async function resolveCitationLabels(db: ReturnType<typeof getDb>, citations: Citation[]) {
  const patentIds = citations.filter(c => c.sourceType === 'patent').map(c => c.sourceId);
  const netisIds = citations.filter(c => c.sourceType === 'netis').map(c => c.sourceId);
  const techIds = citations.filter(c => c.sourceType === 'technology').map(c => c.sourceId);
  const claimIds = citations.filter(c => c.sourceType === 'patent_claim').map(c => c.sourceId);

  const [patentRows, netisRows, techRows, claimRows] = await Promise.all([
    patentIds.length ? db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : Promise.resolve([]),
    netisIds.length ? db.select().from(s.netisTechnologies).where(inArray(s.netisTechnologies.id, netisIds)) : Promise.resolve([]),
    techIds.length ? db.select().from(s.technologies).where(inArray(s.technologies.id, techIds)) : Promise.resolve([]),
    claimIds.length ? db.select().from(s.patentClaims).where(inArray(s.patentClaims.id, claimIds)) : Promise.resolve([])
  ]);
  const patentById = new Map(patentRows.map(p => [p.id, p]));
  const netisById = new Map(netisRows.map(n => [n.id, n]));
  const techById = new Map(techRows.map(t => [t.id, t]));
  const claimById = new Map(claimRows.map(c => [c.id, c]));

  // patent_claim（FR-M06-002 AI Claim分解の根拠）は、請求項番号＋対象特許名まで
  // 表示できると2クリック以内で根拠に到達しやすい（NFR-U-004）ため、対象特許も引く。
  const claimPatentIds = [...new Set(claimRows.map(c => c.patentId))];
  const claimPatentRows = claimPatentIds.length
    ? await db.select().from(s.patents).where(inArray(s.patents.id, claimPatentIds))
    : [];
  const claimPatentById = new Map(claimPatentRows.map(p => [p.id, p]));

  const labels = new Map<string, string>();
  for (const c of citations) {
    if (c.sourceType === 'patent') {
      const p = patentById.get(c.sourceId);
      labels.set(c.id, p ? `特許：${p.title}` : '特許（削除済み）');
    } else if (c.sourceType === 'netis') {
      const n = netisById.get(c.sourceId);
      labels.set(c.id, n ? `NETIS：${n.name}` : 'NETIS（削除済み）');
    } else if (c.sourceType === 'technology') {
      const t = techById.get(c.sourceId);
      labels.set(c.id, t ? `自社技術：${t.name}` : '自社技術（削除済み）');
    } else if (c.sourceType === 'patent_claim') {
      const claim = claimById.get(c.sourceId);
      const patent = claim ? claimPatentById.get(claim.patentId) : undefined;
      labels.set(c.id, claim ? `請求項${claim.claimNo}：${patent?.title ?? '特許（削除済み）'}` : '請求項（削除済み）');
    } else {
      labels.set(c.id, `${c.sourceType}：${c.sourceId}`);
    }
  }
  return labels;
}
