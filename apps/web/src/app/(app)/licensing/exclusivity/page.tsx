import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import {
  LICENSE_KIND_LABEL, LICENSE_STATUS_LABEL, licenseSubjectLabel, resolveLicenseSubjects, termField
} from '@/lib/legal-license-subjects';


export default async function LicensingExclusivityPage() {
  const db = getDb(getDatabaseUrl());
  const licenses = await db.select().from(s.licenses).orderBy(desc(s.licenses.createdAt));
  const maps = await resolveLicenseSubjects(db, licenses);

  return (
    <ListView
      title="独占 / 非独占"
      moduleCode="S-12 / EXCLUSIVITY TERMS"
      description="ライセンス案件（licenses.terms）の独占（exclusive）／非独占（non-exclusive）条件を確認する画面です。契約条件は本番設計フェーズで法務担当が入力します。"
      rows={licenses}
      emptyMessage="ライセンス案件がまだありません。"
      fields={[
        { key: 'counterpart', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.counterpartName}</span> },
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}>{LICENSE_KIND_LABEL[row.kind] ?? row.kind}</span>
        ) },
        { key: 'subject', render: row => licenseSubjectLabel(maps, row.subjectType, row.subjectId) },
        { key: 'exclusivity', render: row => <span className="mono">{termField(row.terms, 'exclusivity')}</span> },
        { key: 'status', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{LICENSE_STATUS_LABEL[row.status] ?? row.status}</span>
        ) }
      ]}
    />
  );
}
