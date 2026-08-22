import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { count } from 'drizzle-orm';
import { InfoPage } from '@/components/InfoPage';

export const runtime = 'edge';

export default async function AdminStatusPage() {
  const db = getDb(getDatabaseUrl());
  const [patents] = await db.select({ n: count() }).from(s.patents);
  const [users] = await db.select({ n: count() }).from(s.users);

  return (
    <InfoPage
      title="システム状態"
      moduleCode="S-25 / SYSTEM STATUS"
      description="MVP環境の稼働状況です（本番の死活監視・アラートは本番設計フェーズで実装）。"
      badge="MVP"
      blocks={[
        { label: 'データベース接続', value: <span style={{ color: 'var(--green)' }}>正常</span> },
        { label: '登録利用者数', value: `${users?.n ?? 0} 名` },
        { label: '特許データ件数', value: `${patents?.n ?? 0} 件` },
        { label: '実行環境', value: <span className="mono">Cloudflare Pages（Edge Runtime）</span> }
      ]}
      note="このページは本番設計フェーズでヘルスチェック・稼働率・アラート通知と連携する予定です（バックログ）。"
    />
  );
}
