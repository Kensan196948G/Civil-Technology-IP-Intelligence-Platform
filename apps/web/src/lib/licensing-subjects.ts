// M11 ライセンス・知財ポートフォリオ用の共通ヘルパー。
// licenses.subject_type / subject_id はポリモーフィック参照（patent / technology / netis）
// のため、citations.ts と同様のバッチ取得パターンでラベル・リンク先を解決する（N+1回避）。
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

type Subject = { subjectType: string; subjectId: string };

export async function resolveLicenseSubjects(db: ReturnType<typeof getDb>, subjects: Subject[]) {
  const patentIds = [...new Set(subjects.filter(x => x.subjectType === 'patent').map(x => x.subjectId))];
  const techIds = [...new Set(subjects.filter(x => x.subjectType === 'technology').map(x => x.subjectId))];
  const netisIds = [...new Set(subjects.filter(x => x.subjectType === 'netis').map(x => x.subjectId))];

  const [patentRows, techRows, netisRows] = await Promise.all([
    patentIds.length ? db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : Promise.resolve([]),
    techIds.length ? db.select().from(s.technologies).where(inArray(s.technologies.id, techIds)) : Promise.resolve([]),
    netisIds.length ? db.select().from(s.netisTechnologies).where(inArray(s.netisTechnologies.id, netisIds)) : Promise.resolve([])
  ]);
  const patentById = new Map(patentRows.map(p => [p.id, p]));
  const techById = new Map(techRows.map(t => [t.id, t]));
  const netisById = new Map(netisRows.map(n => [n.id, n]));

  return {
    label(subjectType: string, subjectId: string): string {
      if (subjectType === 'patent') return patentById.get(subjectId)?.title ?? '特許（削除済み）';
      if (subjectType === 'technology') return techById.get(subjectId)?.name ?? '自社技術（削除済み）';
      if (subjectType === 'netis') return netisById.get(subjectId)?.name ?? 'NETIS技術（削除済み）';
      return `${subjectType}：${subjectId}`;
    },
    sub(subjectType: string, subjectId: string): string {
      if (subjectType === 'patent') { const p = patentById.get(subjectId); return p ? `${p.applicantName}（${p.country}）` : '—'; }
      if (subjectType === 'technology') { const t = techById.get(subjectId); return t?.kind ?? '—'; }
      if (subjectType === 'netis') { const n = netisById.get(subjectId); return n?.category ?? '—'; }
      return '—';
    },
    href(subjectType: string, subjectId: string): string {
      if (subjectType === 'patent' && patentById.has(subjectId)) return `/patents/${subjectId}`;
      if (subjectType === 'netis' && netisById.has(subjectId)) return `/netis/${subjectId}`;
      return '';
    }
  };
}

export const LICENSE_KIND_LABEL: Record<string, string> = {
  license_in: '技術導入（Buy）',
  license_out: 'ライセンスアウト（Partner）'
};

export const LICENSE_STATUS_LABEL: Record<string, string> = {
  candidate: '候補',
  evaluating: '評価中',
  negotiating: '交渉中',
  agreed: '契約済',
  rejected: '見送り',
  expired: '終了'
};

export const LICENSE_STATUS_COLOR: Record<string, string> = {
  candidate: 'var(--ink-2)',
  evaluating: 'var(--amber)',
  negotiating: 'var(--amber)',
  agreed: 'var(--green)',
  rejected: 'var(--brick)',
  expired: 'var(--brick)'
};
