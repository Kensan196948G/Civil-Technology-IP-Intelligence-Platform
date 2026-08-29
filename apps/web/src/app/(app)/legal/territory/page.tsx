export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import {
  LICENSE_KIND_LABEL, licenseSubjectLabel, resolveLicenseSubjects, termField
} from '@/lib/legal-license-subjects';


export default async function LegalTerritoryPage() {
  const db = getDb(getDatabaseUrl());
  const licenses = await db.select().from(s.licenses).orderBy(desc(s.licenses.createdAt));
  const maps = await resolveLicenseSubjects(db, licenses);

  return (
    <ListView
      title="地域条件"
      moduleCode="S-12 / TERRITORY"
      description="ライセンス案件（licenses.terms）の地域条件と、対象特許が出願・公開されている国（patents.country）を参考情報として確認する画面です。"
      rows={licenses}
      emptyMessage="ライセンス案件がまだありません。"
      fields={[
        { key: 'counterpart', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.counterpartName}</span> },
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}>{LICENSE_KIND_LABEL[row.kind] ?? row.kind}</span>
        ) },
        { key: 'subject', render: row => licenseSubjectLabel(maps, row.subjectType, row.subjectId) },
        { key: 'country', render: row => {
          const country = row.subjectType === 'patent' ? maps.patentById.get(row.subjectId)?.country : undefined;
          return country ? <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>対象特許の国：{country}</span> : null;
        } },
        { key: 'territory', render: row => <span className="mono">{termField(row.terms, 'territory')}</span> }
      ]}
    />
  );
}
