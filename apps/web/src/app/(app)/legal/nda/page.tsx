import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { LICENSE_KIND_LABEL, licenseSubjectLabel, resolveLicenseSubjects } from '@/lib/legal-license-subjects';


// MVPスキーマにNDA専用テーブルは存在しないため、ライセンス案件（licenses）の
// ステータスをNDA締結プロセスの進捗の代理指標として表示する
// （candidate=NDA未着手、evaluating=NDA確認中、それ以外=NDA確認済みと想定）。
function ndaStatus(status: string): { label: string; color: string } {
  if (status === 'candidate') return { label: 'NDA未確認', color: 'var(--brick)' };
  if (status === 'evaluating') return { label: 'NDA確認中', color: 'var(--amber)' };
  return { label: 'NDA確認済み（想定）', color: 'var(--green)' };
}

export default async function LegalNdaPage() {
  const db = getDb(getDatabaseUrl());
  const licenses = await db.select().from(s.licenses).orderBy(desc(s.licenses.createdAt));
  const maps = await resolveLicenseSubjects(db, licenses);

  return (
    <ListView
      title="NDA確認"
      moduleCode="S-12 / NDA CONFIRMATION"
      description="ライセンス案件（licenses）のステータスをもとに、相手方とのNDA（秘密保持契約）締結状況を確認する画面です。NDA単独の管理テーブルはMVPでは未実装のため、案件ステータスを進捗の目安として表示します。"
      rows={licenses}
      emptyMessage="ライセンス案件がまだありません。"
      fields={[
        { key: 'counterpart', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.counterpartName}</span> },
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}>{LICENSE_KIND_LABEL[row.kind] ?? row.kind}</span>
        ) },
        { key: 'subject', render: row => licenseSubjectLabel(maps, row.subjectType, row.subjectId) },
        { key: 'nda', render: row => {
          const nda = ndaStatus(row.status);
          return <span className="badge" style={{ color: nda.color, border: `1px solid ${nda.color}` }}>{nda.label}</span>;
        } }
      ]}
    />
  );
}
