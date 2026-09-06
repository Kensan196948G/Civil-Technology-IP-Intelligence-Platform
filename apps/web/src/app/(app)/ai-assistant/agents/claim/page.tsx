import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { ymd } from '@/lib/labels';
import { getCurrentUser } from '@/lib/auth/current-user';
import { generateClaimComparison } from '../../../claims/actions';
import type { DemoRole } from '@/lib/auth/demo';

// FR-M06-005/006/007: AI Claim比較生成の書込権限（docs/10-requirements/05-rbac-matrix.md
// M06 Claim W）。UI側の表示制御のみ（実効的な認可は claims/actions.ts の
// generateClaimComparison 側で必ず再検証する）。
const CLAIM_COMPARE_ROLES: ReadonlySet<DemoRole> = new Set<DemoRole>(['tech_manager', 'ip']);

// generateClaimComparison が失敗時にリダイレクトする ?compareError=<コード> を
// 画面表示用の日本語メッセージへ変換する。
function describeCompareError(code: string, analysisId?: string): string {
  switch (code) {
    case 'missing_input':
      return '対象の特許と自社技術を選択してください。';
    case 'role_not_allowed':
      return 'この操作を行う権限がありません（技術管理者・知財担当のみ）。';
    case 'already_compared':
      return analysisId
        ? `この特許×技術の組み合わせは既に比較済みです。既存の結果を確認してください（/claims/${analysisId}）。`
        : 'この特許×技術の組み合わせは既に比較済みです。既存の結果を確認してください。';
    case 'technology_not_found':
      return '指定された自社技術が見つかりません。';
    case 'technology_summary_missing':
      return '対象の自社技術に説明文（summary）が登録されていません。';
    case 'patent_claims_missing':
      return '対象特許に請求項が登録されていません。';
    case 'claim_not_decomposed':
      return '対象特許の請求項がまだ構成要件に分解されていません。先に特許詳細ページで「AIで構成要件に分解」を行ってください。';
    case 'ai_call_failed':
      return 'AI比較の実行に失敗しました。時間をおいて再度お試しください。';
    case 'no_valid_rows':
      return '有効な比較結果を生成できませんでした（AIの応答が自社技術の説明文と整合しませんでした）。';
    default:
      return '比較の生成に失敗しました。';
  }
}

export default async function ClaimAgentPage({
  searchParams
}: {
  searchParams: Promise<{ compareError?: string; analysisId?: string }>;
}) {
  // Next.js 15: searchParams は Promise になったため await する
  const sp = await searchParams;
  const db = getDb(getDatabaseUrl());
  const user = await getCurrentUser();
  const canCompare = !!user && CLAIM_COMPARE_ROLES.has(user.role);

  const analyses = await db.select().from(s.claimAnalyses).orderBy(desc(s.claimAnalyses.createdAt));

  const patentIds = [...new Set(analyses.map(a => a.patentId))];
  const techIds = [...new Set(analyses.map(a => a.technologyId))];
  const [patentRows, techRows] = await Promise.all([
    patentIds.length ? db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : Promise.resolve([]),
    techIds.length ? db.select().from(s.technologies).where(inArray(s.technologies.id, techIds)) : Promise.resolve([])
  ]);
  const patentById = new Map(patentRows.map(p => [p.id, p]));
  const techById = new Map(techRows.map(t => [t.id, t]));

  // 新規比較フォーム用の選択肢（全件。デモ規模のため件数制限は設けない）。
  const [allPatents, allTechnologies] = await Promise.all([
    db.select({ id: s.patents.id, title: s.patents.title, applicantName: s.patents.applicantName })
      .from(s.patents).orderBy(asc(s.patents.title)),
    db.select({ id: s.technologies.id, name: s.technologies.name })
      .from(s.technologies).orderBy(asc(s.technologies.name))
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ListView
        title="Claim Agent"
        moduleCode="S-14 / AI ASSISTANT"
        description="他社特許の請求項と自社案の構成要件をAIが対比するAgentです。claim_analyses台帳の比較結果を一覧表示します。行から詳細な構成要件チャートを確認できます。"
        rows={analyses}
        emptyMessage="Claim Agentによる比較結果はまだありません。"
        rowHref={row => `/claims/${row.id}`}
        fields={[
          { key: 'patent', grow: true, render: row => <span style={{ fontWeight: 700 }}>{patentById.get(row.patentId)?.title ?? '（削除済み特許）'}</span> },
          { key: 'vs', render: () => <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>vs</span> },
          { key: 'tech', render: row => <span style={{ fontSize: 12.5 }}>{techById.get(row.technologyId)?.name ?? '（削除済み技術）'}</span> },
          { key: 'createdAt', mono: true, render: row => ymd(row.createdAt) }
        ]}
      />

      {/* FR-M06-020（MUST）: 類似度の表示には「侵害判断ではない」旨の注記を常時併記し、
          除去できないUIとする。固定表示（非表示切替のUIを設けない）。 */}
      <div className="notice notice-brick">
        <strong>類似度は権利侵害の判断ではありません。</strong>
        AIによる一致(match)/類似(similar)/相違(differ)の判定は、専門家が確認すべき箇所を
        絞り込むための参考情報です。本結果を侵害可能性の結論として社外へ提示しないでください。
      </div>

      <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>新規比較を作成（AI Claim Compare）</div>
        <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          対象特許の構成要件（独立請求項を優先。未分解の場合は先に特許詳細ページで構成要件分解を
          行ってください）と自社技術の説明文をAIで比較し、Claim Chart（claim_analyses /
          claim_chart_rows）を生成します。
        </p>
        {sp.compareError && (
          <div className="notice notice-amber">{describeCompareError(sp.compareError, sp.analysisId)}</div>
        )}
        {canCompare ? (
          <form action={generateClaimComparison} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              対象特許
              <select name="patentId" required style={{ minWidth: 280 }}>
                <option value="">選択してください</option>
                {allPatents.map(p => (
                  <option key={p.id} value={p.id}>{p.title}（{p.applicantName}）</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              自社技術
              <select name="technologyId" required style={{ minWidth: 220 }}>
                <option value="">選択してください</option>
                {allTechnologies.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-primary" style={{ fontSize: 12.5 }}>
              AIで比較を生成
            </button>
          </form>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>比較の生成権限がありません（技術管理者・知財担当のみ）。</div>
        )}
      </div>
    </div>
  );
}
