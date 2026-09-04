import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

// M27 Patent Prosecution / Dossier Intelligence — 特許庁審査経過の時系列イベント。
// 要件: docs/90-project/06-first-wave-fr-drafts.md（FR-M27-001/002/005）
// 収集は MVP ではデモデータ投入のみ。実データ化は JPO API / OPD / EPO OPS 連携（将来フェーズ）。
// ※従来の「社内ワークフロー（workflow_instances）を代用」した表示から、公式の審査経過表示へ置換。

const KIND_META: Record<string, { label: string; color: string }> = {
  application: { label: '出願', color: 'var(--ink-3)' },
  exam_request: { label: '審査請求', color: 'var(--blue)' },
  rejection: { label: '拒絶理由通知', color: '#c0392b' },
  amendment: { label: '補正', color: '#b7791f' },
  opinion: { label: '意見書', color: 'var(--blue)' },
  registration: { label: '登録', color: '#1e7d46' },
  other: { label: 'その他', color: 'var(--ink-3)' }
};

export default async function PatentProsecutionPage() {
  const db = getDb(getDatabaseUrl());
  const events = await db.select().from(s.prosecutionEvents).orderBy(desc(s.prosecutionEvents.occurredOn), desc(s.prosecutionEvents.createdAt));

  const patentIds = [...new Set(events.map(e => e.patentId))];
  const patents = patentIds.length ? await db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : [];
  const patentById = new Map(patents.map(p => [p.id, p]));

  const counts = {
    total: events.length,
    rejection: events.filter(e => e.kind === 'rejection').length,
    amendment: events.filter(e => e.kind === 'amendment').length,
    registration: events.filter(e => e.kind === 'registration').length
  };

  const rows = events.map(e => ({
    id: e.id,
    patentId: e.patentId,
    patentTitle: patentById.get(e.patentId)?.title ?? '特許（削除済み）',
    pubNo: patentById.get(e.patentId)?.publicationNo ?? '',
    kind: e.kind,
    description: e.description,
    occurredOn: String(e.occurredOn)
  }));

  const chips = [
    { label: '審査経過イベント', n: counts.total },
    { label: '拒絶理由通知', n: counts.rejection },
    { label: '補正', n: counts.amendment },
    { label: '登録', n: counts.registration }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {chips.map(chip => (
          <div key={chip.label} className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span className="mono" style={{ fontSize: 20, color: 'var(--blue)' }}>{chip.n}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{chip.label}</span>
          </div>
        ))}
      </div>
      <ListView
        title="審査経過"
        moduleCode="M27 / PROSECUTION"
        description="特許ごとの審査経過（出願→審査請求→拒絶理由→補正→意見書→登録）の時系列イベントです。「最初は広かった Claim が、審査で何を限定されて登録されたか」の確認に使います（法的評価は LegalOps・弁理士）。"
        badge="第一拡張群"
        rows={rows}
        emptyMessage="審査経過の記録がまだありません。"
        rowHref={row => `/patents/${row.patentId}`}
        fields={[
          { key: 'patent', render: row => (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 260 }}>
              <span style={{ fontWeight: 700, fontSize: 12.5 }}>{row.patentTitle.slice(0, 30)}{row.patentTitle.length > 30 ? '…' : ''}</span>
              {row.pubNo && <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{row.pubNo}</span>}
            </span>
          ) },
          { key: 'kind', render: row => {
            const meta = KIND_META[row.kind] ?? { label: row.kind, color: 'var(--ink-3)' };
            return <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, whiteSpace: 'nowrap' }}>{meta.label}</span>;
          } },
          { key: 'description', grow: true, render: row => <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>{row.description}</span> },
          { key: 'date', mono: true, render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.occurredOn}</span> }
        ]}
      />
    </div>
  );
}
