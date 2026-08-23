import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { ymd } from '@/lib/labels';
import {
  LICENSE_KIND_LABEL, licenseSubjectLabel, resolveLicenseSubjects, termField
} from '@/lib/legal-license-subjects';

export const runtime = 'edge';

export default async function LegalTermPage() {
  const db = getDb(getDatabaseUrl());
  const licenses = await db.select().from(s.licenses).orderBy(desc(s.licenses.createdAt));
  const maps = await resolveLicenseSubjects(db, licenses);

  return (
    <ListView
      title="契約期間"
      moduleCode="S-12 / CONTRACT TERM"
      description="ライセンス案件（licenses.terms）の契約期間条件を確認する画面です。案件の登録日（createdAt）も参考情報として表示します。"
      rows={licenses}
      emptyMessage="ライセンス案件がまだありません。"
      fields={[
        { key: 'counterpart', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.counterpartName}</span> },
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}>{LICENSE_KIND_LABEL[row.kind] ?? row.kind}</span>
        ) },
        { key: 'subject', render: row => licenseSubjectLabel(maps, row.subjectType, row.subjectId) },
        { key: 'term', render: row => <span className="mono">{termField(row.terms, 'term')}</span> },
        { key: 'registered', mono: true, render: row => `登録 ${ymd(row.createdAt)}` }
      ]}
    />
  );
}
