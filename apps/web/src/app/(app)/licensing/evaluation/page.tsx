import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { sql, desc } from 'drizzle-orm';
import { InfoPage } from '@/components/InfoPage';
import { resolveLicenseSubjects, LICENSE_KIND_LABEL, LICENSE_STATUS_LABEL, LICENSE_STATUS_COLOR } from '@/lib/licensing-subjects';

export const runtime = 'edge';

type StatusRow = { status: string; n: number };

export default async function EvaluationPage() {
  const db = getDb(getDatabaseUrl());
  const licenses = await db.select().from(s.licenses).orderBy(desc(s.licenses.createdAt));
  const subjects = await resolveLicenseSubjects(db, licenses);

  const statusResult = await db.execute(sql`
    select status, count(*) as n from licenses group by status order by n desc
  `);
  const statusRows = statusResult.rows as unknown as StatusRow[];

  const inboundN = licenses.filter(l => l.kind === 'license_in').length;
  const outboundN = licenses.filter(l => l.kind === 'license_out').length;

  return (
    <InfoPage
      title="ライセンス評価"
      moduleCode="S-11i / LICENSING & IP PORTFOLIO"
      description="ライセンス案件全体の評価状況を、ステータス別・区分別に集計します。"
      blocks={[
        { label: '案件総数', value: `${licenses.length} 件` },
        { label: '技術導入（Buy）', value: `${inboundN} 件` },
        { label: 'ライセンスアウト（Partner）', value: `${outboundN} 件` },
        ...statusRows.map(r => ({ label: `ステータス：${LICENSE_STATUS_LABEL[r.status] ?? r.status}`, value: `${r.n} 件` }))
      ]}
    >
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          案件別 評価一覧
        </div>
        <div>
          {licenses.length === 0 && (
            <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>ライセンス案件はまだありません。</div>
          )}
          {licenses.map(l => (
            <div key={l.id} style={{ padding: '12px 16px', borderBottom: '1px solid #E8EDED', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{LICENSE_KIND_LABEL[l.kind] ?? l.kind}</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{subjects.label(l.subjectType, l.subjectId)}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>相手方：{l.counterpartName}</span>
              <span style={{ flexGrow: 1 }} />
              <span className="badge" style={{ color: LICENSE_STATUS_COLOR[l.status] ?? 'var(--ink-2)', border: `1px solid ${LICENSE_STATUS_COLOR[l.status] ?? 'var(--line)'}` }}>
                {LICENSE_STATUS_LABEL[l.status] ?? l.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </InfoPage>
  );
}
