import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

const KIND_LABEL: Record<string, string> = {
  examine: 'AI模擬審査（Examiner Agent）',
  claim_compare: 'Claim比較（Claim Agent）',
  field_score: '現場適用性スコアリング（Civil Engineer Agent）'
};

export default async function AiAssistantJobsPage() {
  const db = getDb(getDatabaseUrl());
  const runs = await db.select().from(s.aiRuns).orderBy(desc(s.aiRuns.createdAt));

  const runIds = runs.map(r => r.id);
  const citations = runIds.length ? await db.select().from(s.aiCitations).where(inArray(s.aiCitations.aiRunId, runIds)) : [];
  const citationCountByRun = new Map<string, number>();
  for (const c of citations) citationCountByRun.set(c.aiRunId, (citationCountByRun.get(c.aiRunId) ?? 0) + 1);

  return (
    <ListView
      title="自律調査ジョブ"
      moduleCode="S-14 / AI ASSISTANT"
      description="各Agentが実行したAIジョブ（ai_runs）の一覧です。ジョブごとに根拠件数（ai_citations）を表示します。詳細な引用元は「AI実行履歴・根拠」画面で確認できます。"
      rows={runs}
      emptyMessage="実行済みの自律調査ジョブはまだありません。"
      fields={[
        { key: 'kind', grow: true, render: row => <span style={{ fontWeight: 700 }}>{KIND_LABEL[row.kind] ?? row.kind}</span> },
        { key: 'status', render: row => (
          <span className="badge" style={{ color: row.status === 'succeeded' ? 'var(--green)' : 'var(--amber)', border: `1px solid ${row.status === 'succeeded' ? 'var(--green)' : 'var(--amber)'}` }}>
            {row.status}
          </span>
        ) },
        { key: 'model', mono: true, render: row => row.model },
        { key: 'citations', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>根拠 {citationCountByRun.get(row.id) ?? 0} 件</span> },
        { key: 'createdAt', mono: true, render: row => String(row.createdAt).slice(0, 16).replace('T', ' ') }
      ]}
    />
  );
}
