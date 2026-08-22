import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { resolveLicenseSubjects, LICENSE_KIND_LABEL, LICENSE_STATUS_LABEL, LICENSE_STATUS_COLOR } from '@/lib/licensing-subjects';

export const runtime = 'edge';

export default async function LicensingCandidatesPage() {
  const db = getDb(getDatabaseUrl());
  const licenses = await db.select().from(s.licenses).orderBy(desc(s.licenses.createdAt));
  const subjects = await resolveLicenseSubjects(db, licenses);

  return (
    <ListView
      title="ライセンス候補・事例"
      moduleCode="S-11a / LICENSING & IP PORTFOLIO"
      description="技術導入（Buy）・ライセンスアウト（Partner）双方の案件を、対象種別を問わず横断的に一覧します。"
      rows={licenses}
      emptyMessage="ライセンス案件はまだありません。"
      rowHref={row => subjects.href(row.subjectType, row.subjectId)}
      fields={[
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{LICENSE_KIND_LABEL[row.kind] ?? row.kind}</span>
        ) },
        { key: 'subject', grow: true, render: row => (
          <span>
            <span style={{ fontWeight: 700 }}>{subjects.label(row.subjectType, row.subjectId)}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}> ｜ 相手方：{row.counterpartName}</span>
          </span>
        ) },
        { key: 'status', render: row => (
          <span className="badge" style={{ color: LICENSE_STATUS_COLOR[row.status] ?? 'var(--ink-2)', border: `1px solid ${LICENSE_STATUS_COLOR[row.status] ?? 'var(--line)'}` }}>
            {LICENSE_STATUS_LABEL[row.status] ?? row.status}
          </span>
        ) }
      ]}
    />
  );
}
