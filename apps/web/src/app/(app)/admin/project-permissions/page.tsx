export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


const KIND_LABEL: Record<string, string> = {
  invention: '発明届', field_adoption: '現場導入', license_in: 'ライセンスイン'
};

type ProjectPermRow = {
  id: string;
  title: string;
  kind: string;
  classification: string;
  status: string;
  authorName: string;
  role: string;
  departmentName: string | null;
  humanCheckRequired: boolean;
};

export default async function AdminProjectPermissionsPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select wi.id, wi.title, wi.kind, wi.classification, wi.status, wi.human_check_required,
           u.display_name as author_name, u.role as role, d.name as department_name
    from workflow_instances wi
    join users u on u.id = wi.author_id
    left join departments d on d.id = u.department_id
    order by wi.created_at desc
  `);
  const rows: ProjectPermRow[] = (result.rows as any[]).map(r => ({
    id: r.id as string,
    title: r.title as string,
    kind: r.kind as string,
    classification: r.classification as string,
    status: r.status as string,
    authorName: r.author_name as string,
    role: r.role as string,
    departmentName: r.department_name as string | null,
    humanCheckRequired: Boolean(r.human_check_required)
  }));

  return (
    <ListView
      title="プロジェクト権限"
      moduleCode="S-19 / SYSTEM ADMIN"
      description="案件（プロジェクト）ごとの起案者権限と必要な機密区分です。起案者がその案件の編集権限を持ちます。行をクリックすると案件詳細（承認）画面に遷移します。"
      rows={rows}
      emptyMessage="登録済みの案件はありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'kind', mono: true, render: row => KIND_LABEL[row.kind] ?? row.kind },
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'owner', render: row => `起案 ${row.authorName}（${row.departmentName ?? '所属不明'}）` },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: row.classification === 'C3' || row.classification === 'C4' ? 'var(--amber)' : 'var(--green)', border: `1px solid ${row.classification === 'C3' || row.classification === 'C4' ? 'var(--amber)' : 'var(--green)'}` }}>{row.classification}</span>
        ) },
        { key: 'humanCheck', render: row => row.humanCheckRequired
          ? <span className="badge" style={{ color: 'var(--brick)', border: '1px solid var(--brick)' }}>人間確認必須</span>
          : null
        }
      ]}
    />
  );
}
