// 「12. 法務・知財レビュー」セクション専用の補助関数。
// licenses.subject_type / subject_id はポリモーフィック参照（patent / technology / netis）のため、
// lib/citations.ts と同じバッチ取得パターンでN+1を避けてラベル・関連情報を解決する。
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

export type LicenseSubjectRef = { subjectType: string; subjectId: string };

export async function resolveLicenseSubjects(db: ReturnType<typeof getDb>, refs: LicenseSubjectRef[]) {
  const patentIds = [...new Set(refs.filter(r => r.subjectType === 'patent').map(r => r.subjectId))];
  const techIds = [...new Set(refs.filter(r => r.subjectType === 'technology').map(r => r.subjectId))];
  const netisIds = [...new Set(refs.filter(r => r.subjectType === 'netis').map(r => r.subjectId))];

  const [patentRows, techRows, netisRows] = await Promise.all([
    patentIds.length ? db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : Promise.resolve([]),
    techIds.length ? db.select().from(s.technologies).where(inArray(s.technologies.id, techIds)) : Promise.resolve([]),
    netisIds.length ? db.select().from(s.netisTechnologies).where(inArray(s.netisTechnologies.id, netisIds)) : Promise.resolve([])
  ]);

  return {
    patentById: new Map(patentRows.map(p => [p.id, p])),
    techById: new Map(techRows.map(t => [t.id, t])),
    netisById: new Map(netisRows.map(n => [n.id, n]))
  };
}

export type LicenseSubjectMaps = Awaited<ReturnType<typeof resolveLicenseSubjects>>;

export function licenseSubjectLabel(maps: LicenseSubjectMaps, subjectType: string, subjectId: string): string {
  if (subjectType === 'patent') return maps.patentById.get(subjectId)?.title ?? '特許（削除済み）';
  if (subjectType === 'technology') return maps.techById.get(subjectId)?.name ?? '自社技術（削除済み）';
  if (subjectType === 'netis') return maps.netisById.get(subjectId)?.name ?? 'NETIS技術（削除済み）';
  return `${subjectType}：${subjectId}`;
}

export const LICENSE_KIND_LABEL: Record<string, string> = {
  license_in: 'ライセンスイン（導入）',
  license_out: 'ライセンスアウト（供与）'
};

export const LICENSE_STATUS_LABEL: Record<string, string> = {
  candidate: '候補',
  evaluating: '評価中',
  active: '契約中',
  executed: '締結済み',
  terminated: '終了',
  rejected: '見送り'
};

const UNSET = '未設定（本番設計で入力）';

// terms は現状MVPシードでは空オブジェクトだが、本番設計で契約条件が入力された際に
// そのままキー参照で表示できるよう、文字列/数値/真偽値のみを安全に取り出す。
export function termField(terms: unknown, key: string): string {
  if (terms && typeof terms === 'object' && key in (terms as Record<string, unknown>)) {
    const v = (terms as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.length > 0) return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  }
  return UNSET;
}
