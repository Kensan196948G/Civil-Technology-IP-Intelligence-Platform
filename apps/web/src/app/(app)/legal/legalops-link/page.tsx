import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { like } from 'drizzle-orm';
import { InfoPage, type InfoBlock } from '@/components/InfoPage';

export const runtime = 'edge';

type IntegrationValue = { enabled?: boolean; note?: string };

export default async function LegalOpsLinkPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.settings).where(like(s.settings.key, 'integration.%'));

  const blocks: InfoBlock[] = rows.map(r => {
    const v = r.value as IntegrationValue;
    return {
      label: r.description ?? r.key,
      value: (
        <span>
          <span style={{ color: v.enabled ? 'var(--green)' : 'var(--ink-2)' }}>{v.enabled ? '連携中' : '未接続'}</span>
          {v.note && <span style={{ color: 'var(--ink-2)', marginLeft: 8, fontSize: 11.5 }}>（{v.note}）</span>}
        </span>
      )
    };
  });
  blocks.push({
    label: 'Construction-LegalOps-DX 連携',
    value: <span style={{ color: 'var(--ink-2)' }}>未接続（本番設計フェーズで外部連携APIを追加予定）</span>
  });

  return (
    <InfoPage
      title="Construction-LegalOps-DX連携"
      moduleCode="S-12 / EXTERNAL LEGAL SYSTEM LINK"
      description="外部の法務ワークフローシステム（Construction-LegalOps-DX）との連携状況です。settings テーブルの外部データ連携設定（integration.*）を横断表示し、現状の接続状態を示します。"
      badge="MVP"
      blocks={blocks}
      note="MVPでは settings.key='integration.*' に本番接続情報はまだ登録されていません。Construction-LegalOps-DXとの契約データ相互連携（審査依頼の自動起票・レビュー結果の同期）は本番設計フェーズのバックログです。"
    />
  );
}
