export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { LICENSE_KIND_LABEL, LICENSE_STATUS_LABEL, LICENSE_STATUS_COLOR } from '@/lib/licensing-subjects';


export default async function OpenPatentsPage() {
  const db = getDb(getDatabaseUrl());
  const patentLicenses = await db.select().from(s.licenses).where(eq(s.licenses.subjectType, 'patent'));

  const patentIds = [...new Set(patentLicenses.map(l => l.subjectId))];
  const patents = patentIds.length ? await db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : [];

  const licensesByPatent = new Map<string, typeof patentLicenses>();
  for (const l of patentLicenses) {
    const arr = licensesByPatent.get(l.subjectId) ?? [];
    arr.push(l);
    licensesByPatent.set(l.subjectId, arr);
  }

  return (
    <ListView
      title="開放特許"
      moduleCode="S-11b / LICENSING & IP PORTFOLIO"
      description="ライセンス案件の対象となっている特許を、特許単位で名寄せして一覧します。技術導入・ライセンスアウトいずれかの取引対象として「開放」されている特許です。"
      rows={patents}
      emptyMessage="ライセンス対象となっている特許はまだありません。"
      rowHref={row => `/patents/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'applicant', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.applicantName}（{row.country}）</span> },
        { key: 'deals', render: row => {
          const deals = licensesByPatent.get(row.id) ?? [];
          return (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {deals.map(d => (
                <span key={d.id} className="badge" style={{ color: LICENSE_STATUS_COLOR[d.status] ?? 'var(--ink-2)', border: `1px solid ${LICENSE_STATUS_COLOR[d.status] ?? 'var(--line)'}` }}>
                  {LICENSE_KIND_LABEL[d.kind] ?? d.kind} / {LICENSE_STATUS_LABEL[d.status] ?? d.status}
                </span>
              ))}
            </div>
          );
        } }
      ]}
    />
  );
}
