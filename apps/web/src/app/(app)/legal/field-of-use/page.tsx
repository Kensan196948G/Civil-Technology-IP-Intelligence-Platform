export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import {
  LICENSE_KIND_LABEL, licenseSubjectLabel, resolveLicenseSubjects, termField
} from '@/lib/legal-license-subjects';


// 契約上の利用分野（terms.fieldOfUse）に加えて、対象特許・技術に登録された
// work_types（工種）を参考情報として表示する（土木領域での「利用分野」に直結する実データ）。
function referenceWorkTypes(
  maps: Awaited<ReturnType<typeof resolveLicenseSubjects>>,
  subjectType: string,
  subjectId: string
): string[] {
  if (subjectType === 'patent') return maps.patentById.get(subjectId)?.workTypes ?? [];
  if (subjectType === 'technology') return maps.techById.get(subjectId)?.workTypes ?? [];
  return [];
}

export default async function LegalFieldOfUsePage() {
  const db = getDb(getDatabaseUrl());
  const licenses = await db.select().from(s.licenses).orderBy(desc(s.licenses.createdAt));
  const maps = await resolveLicenseSubjects(db, licenses);

  return (
    <ListView
      title="利用分野"
      moduleCode="S-12 / FIELD OF USE"
      description="ライセンス案件（licenses.terms）の利用分野条件と、対象特許・自社技術に登録された工種（work_types）を参考情報として確認する画面です。"
      rows={licenses}
      emptyMessage="ライセンス案件がまだありません。"
      fields={[
        { key: 'counterpart', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.counterpartName}</span> },
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}>{LICENSE_KIND_LABEL[row.kind] ?? row.kind}</span>
        ) },
        { key: 'subject', render: row => licenseSubjectLabel(maps, row.subjectType, row.subjectId) },
        { key: 'fieldOfUse', render: row => <span className="mono">{termField(row.terms, 'fieldOfUse')}</span> },
        { key: 'workTypes', render: row => {
          const wt = referenceWorkTypes(maps, row.subjectType, row.subjectId);
          return wt.length > 0
            ? <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>参考工種：{wt.join(' / ')}</span>
            : null;
        } }
      ]}
    />
  );
}
