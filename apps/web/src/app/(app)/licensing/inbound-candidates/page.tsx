import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { resolveLicenseSubjects, LICENSE_STATUS_LABEL, LICENSE_STATUS_COLOR } from '@/lib/licensing-subjects';

export const runtime = 'edge';

export default async function InboundCandidatesPage() {
  const db = getDb(getDatabaseUrl());
  const licenses = await db.select().from(s.licenses)
    .where(and(eq(s.licenses.kind, 'license_in')))
    .orderBy(desc(s.licenses.createdAt));
  const subjects = await resolveLicenseSubjects(db, licenses);

  return (
    <ListView
      title="技術導入候補"
      moduleCode="S-11c / LICENSING & IP PORTFOLIO"
      description="社外の特許・技術を自社に導入（ライセンスイン）する候補案件の一覧です。"
      rows={licenses}
      emptyMessage="技術導入候補の案件はまだありません。"
      rowHref={row => subjects.href(row.subjectType, row.subjectId)}
      fields={[
        { key: 'subject', grow: true, render: row => <span style={{ fontWeight: 700 }}>{subjects.label(row.subjectType, row.subjectId)}</span> },
        { key: 'counterpart', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>提供元：{row.counterpartName} ｜ {subjects.sub(row.subjectType, row.subjectId)}</span> },
        { key: 'status', render: row => (
          <span className="badge" style={{ color: LICENSE_STATUS_COLOR[row.status] ?? 'var(--ink-2)', border: `1px solid ${LICENSE_STATUS_COLOR[row.status] ?? 'var(--line)'}` }}>
            {LICENSE_STATUS_LABEL[row.status] ?? row.status}
          </span>
        ) }
      ]}
    />
  );
}
