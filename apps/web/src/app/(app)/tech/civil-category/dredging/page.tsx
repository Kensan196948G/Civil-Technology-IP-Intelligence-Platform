import { ListView } from '@/components/ListView';
import { loadCivilCategoryRows, KIND_LABEL } from '../_lib';

export const runtime = 'edge';

export default async function CivilCategoryDredgingPage() {
  const rows = await loadCivilCategoryRows(['dredging', 'reclamation'], '浚渫');

  return (
    <ListView
      title="土木技術・現場適用 — 浚渫・埋立"
      moduleCode="S-06 / CIVIL TECH CATEGORY"
      description="工種区分「浚渫・埋立」に該当する他社特許・自社技術・NETIS登録技術を横断表示します。"
      rows={rows}
      emptyMessage="工種区分「浚渫・埋立」に該当する技術・特許はまだありません。"
      rowHref={row => row.href}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{KIND_LABEL[row.kind]}</span>
        ) },
        { key: 'sub', render: row => row.sub },
        { key: 'sample', render: row => row.isSample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}
