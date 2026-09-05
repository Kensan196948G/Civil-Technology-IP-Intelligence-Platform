import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { count, eq } from 'drizzle-orm';
import { InfoPage } from '@/components/InfoPage';
import { getCurrentUser } from '@/lib/auth/current-user';
import { redirect } from 'next/navigation';
import { visibleWhere } from '@/lib/authz/row-visibility';

// #11 C3/C4 行レベル制御: 集計件数にも権限外の C3（発明 workflow）を含めない。

export default async function ExaminerHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb(getDatabaseUrl());
  const [me] = await db.select().from(s.users).where(eq(s.users.email, user.email)).limit(1);

  const [runsCount] = await db.select({ n: count() }).from(s.aiRuns);
  const [analysesCount] = await db.select({ n: count() }).from(s.claimAnalyses);
  const workflows = await db.select().from(s.workflowInstances)
    .where(visibleWhere(s.workflowInstances.classification, s.workflowInstances.authorId, { role: user.role, viewerUserId: me?.id }));
  const riskEvaluated = workflows.filter(w => w.aiRiskSummary != null).length;
  const [modelSetting] = await db.select().from(s.settings).where(eq(s.settings.key, 'ai.model.examiner')).limit(1);
  const [flag] = await db.select().from(s.featureFlags).where(eq(s.featureFlags.key, 'ai_examiner_v2')).limit(1);

  const modelValue = (modelSetting?.value ?? {}) as { model?: string };

  return (
    <InfoPage
      title="AI Patent Examiner"
      moduleCode="S-14 / AI PATENT REVIEW"
      description="請求項・技術情報をもとに、新規性・進歩性・記載要件などの観点でAIが模擬審査を行う機能群です。左メニューの各項目から観点別のレビュー結果を確認できます。"
      badge="MVP"
      blocks={[
        { label: 'AI実行件数（累計）', value: `${runsCount?.n ?? 0} 件` },
        { label: 'Claim比較 実施件数', value: `${analysesCount?.n ?? 0} 件` },
        { label: 'リスク評価済みワークフロー', value: `${riskEvaluated} / ${workflows.length} 件` },
        { label: '使用モデル（AI模擬審査）', value: <span className="mono">{modelValue.model ?? '未設定'}</span> },
        { label: '次期モデル（v2）先行有効化', value: flag?.enabled
          ? <span style={{ color: 'var(--green)' }}>有効</span>
          : <span style={{ color: 'var(--ink-2)' }}>無効</span> }
      ]}
      note="AIによる判定はあくまで参考情報であり、法的な拒絶理由・侵害可能性の最終判断を代替するものではありません。実際の出願・審査対応は必ず知財担当者・弁理士が確認してください。"
    />
  );
}
