import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

type Citation = { id: string; sourceType: string; sourceId: string };

export async function resolveCitationLabels(db: ReturnType<typeof getDb>, citations: Citation[]) {
  const patentIds = citations.filter(c => c.sourceType === 'patent').map(c => c.sourceId);
  const netisIds = citations.filter(c => c.sourceType === 'netis').map(c => c.sourceId);
  const techIds = citations.filter(c => c.sourceType === 'technology').map(c => c.sourceId);

  const [patentRows, netisRows, techRows] = await Promise.all([
    patentIds.length ? db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : Promise.resolve([]),
    netisIds.length ? db.select().from(s.netisTechnologies).where(inArray(s.netisTechnologies.id, netisIds)) : Promise.resolve([]),
    techIds.length ? db.select().from(s.technologies).where(inArray(s.technologies.id, techIds)) : Promise.resolve([])
  ]);
  const patentById = new Map(patentRows.map(p => [p.id, p]));
  const netisById = new Map(netisRows.map(n => [n.id, n]));
  const techById = new Map(techRows.map(t => [t.id, t]));

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
    } else {
      labels.set(c.id, `${c.sourceType}：${c.sourceId}`);
    }
  }
  return labels;
}
