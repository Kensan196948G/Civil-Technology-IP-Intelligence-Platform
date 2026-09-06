'use server';
// FR-M06-005/006/007: 他社特許の構成要件（claim_elements）と自社技術の説明文を
// AIで比較し、claim_analyses / claim_chart_rows を生成する Server Action。
//
// 正とする文書:
// - docs/10-requirements/02-functional-requirements.md FR-M06-005/006/007/008/020/021
// - docs/10-requirements/05-rbac-matrix.md M06 Claim（W: tech_manager / ip のみ）
// - docs/20-architecture/adr/ADR-0006-provenance-first.md（quoted_text は機械的に切り出す。
//   ai_citations が0件の ai_runs は status='invalid' とし claim_chart_rows へも反映しない）
//
// 対象claimの選定方針: claim_analyses は patent_id 単位（claim_id を持たない）ため、
// 対象特許の独立請求項（is_independent=true）のうち claim_no が最小のものを比較対象と
// する（複数請求項がある場合、Claim Chartは一般に独立請求項を基準にするため）。
// 独立請求項が見つからない場合は claim_no が最小の請求項を用いる。
//
// 重複実行時の扱い: patents/[id]/actions.ts の decomposeClaim（既に構成要件が
// あるClaimへの再実行を抑止）と同じ判断に揃え、同一 (patent_id, technology_id) の
// 組み合わせに既存の claim_analyses がある場合は再生成を抑止する
// （denied: already_compared）。claim_chart_rows は claim_elements・claim_analyses を
// 参照するため、既存データを削除して置き換える実装は参照整合性と監査ログの追跡性を
// 損なう恐れがある。再生成したい場合は将来的に「新しい比較結果を別バージョンとして
// 追加し、表示側で最新版を選ぶ」方式へ拡張することをバックログとする。
import { getDb } from '@/lib/db/client';
import { getRawSql, type TaggedSql } from '@/lib/db/raw';
import { getDatabaseUrl, getAnthropicModel } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCurrentDbUser } from '@/lib/auth/require-user';
import { logAudit, auditLogTxnStatement } from '@/lib/audit/log';
import { runClaimComparison, type ClaimElementInput } from '@/lib/ai/claim-compare';
import type { DemoRole } from '@/lib/auth/demo';

// RBAC §3 M06 Claim: R/W は tech_manager, ip のみ。
const CLAIM_COMPARE_ROLES: ReadonlySet<DemoRole> = new Set<DemoRole>(['tech_manager', 'ip']);

const CLAIM_AGENT_PAGE = '/ai-assistant/agents/claim';

function toJsonbParam(value: unknown): string {
  return JSON.stringify(value ?? {});
}

/**
 * 対象特許・自社技術を指定し、AIでClaim比較（claim_analyses / claim_chart_rows）を
 * 生成する。エラー時はフォームの遷移元（ai-assistant/agents/claim）へ
 * ?compareError=<理由コード> 付きでリダイレクトし、画面側で日本語メッセージへ変換する
 * （このプロジェクトは useActionState を使っていないため、既存の redirect ベースの
 * エラー通知パターン（sites/new/actions.ts 等）に合わせる）。
 */
export async function generateClaimComparison(formData: FormData): Promise<void> {
  const patentId = String(formData.get('patentId') ?? '').trim();
  const technologyId = String(formData.get('technologyId') ?? '').trim();
  if (!patentId || !technologyId) {
    redirect(`${CLAIM_AGENT_PAGE}?compareError=missing_input`);
  }

  const dbUrl = getDatabaseUrl();
  const db = getDb(dbUrl);
  // 実行者は認証Cookieから解決する（フォーム値は信用しない）
  const me = await requireCurrentDbUser(db);

  if (!CLAIM_COMPARE_ROLES.has(me.role as DemoRole)) {
    await logAudit(db, {
      actorUserId: me.id, action: 'ai_run', targetType: 'claim_analysis',
      targetId: patentId, result: 'denied', reason: 'role_not_allowed', meta: { role: me.role, technologyId }
    });
    redirect(`${CLAIM_AGENT_PAGE}?compareError=role_not_allowed`);
  }

  const [existing] = await db.select({ id: s.claimAnalyses.id }).from(s.claimAnalyses)
    .where(and(eq(s.claimAnalyses.patentId, patentId), eq(s.claimAnalyses.technologyId, technologyId)))
    .limit(1);
  if (existing) {
    await logAudit(db, {
      actorUserId: me.id, action: 'ai_run', targetType: 'claim_analysis',
      targetId: existing.id, result: 'denied', reason: 'already_compared', meta: { patentId, technologyId }
    });
    redirect(`${CLAIM_AGENT_PAGE}?compareError=already_compared&analysisId=${existing.id}`);
  }

  const [technology] = await db.select().from(s.technologies).where(eq(s.technologies.id, technologyId)).limit(1);
  if (!technology) {
    await logAudit(db, {
      actorUserId: me.id, action: 'ai_run', targetType: 'claim_analysis',
      targetId: patentId, result: 'failure', reason: 'technology_not_found', meta: { technologyId }
    });
    redirect(`${CLAIM_AGENT_PAGE}?compareError=technology_not_found`);
  }
  const technologyText = (technology.summary ?? '').trim();
  if (!technologyText) {
    await logAudit(db, {
      actorUserId: me.id, action: 'ai_run', targetType: 'claim_analysis',
      targetId: patentId, result: 'failure', reason: 'technology_summary_missing', meta: { technologyId }
    });
    redirect(`${CLAIM_AGENT_PAGE}?compareError=technology_summary_missing`);
  }

  const claims = await db.select().from(s.patentClaims).where(eq(s.patentClaims.patentId, patentId)).orderBy(asc(s.patentClaims.claimNo));
  if (claims.length === 0) {
    await logAudit(db, {
      actorUserId: me.id, action: 'ai_run', targetType: 'claim_analysis',
      targetId: patentId, result: 'failure', reason: 'patent_claims_missing'
    });
    redirect(`${CLAIM_AGENT_PAGE}?compareError=patent_claims_missing`);
  }
  const targetClaim = claims.find(c => c.isIndependent) ?? claims[0]!;

  const elements = await db.select().from(s.claimElements)
    .where(eq(s.claimElements.claimId, targetClaim.id)).orderBy(asc(s.claimElements.seq));
  if (elements.length === 0) {
    await logAudit(db, {
      actorUserId: me.id, action: 'ai_run', targetType: 'claim_analysis',
      targetId: patentId, result: 'failure', reason: 'claim_not_decomposed', meta: { claimId: targetClaim.id }
    });
    redirect(`${CLAIM_AGENT_PAGE}?compareError=claim_not_decomposed`);
  }

  const elementInputs: ClaimElementInput[] = elements.map(el => ({ label: el.label, text: el.text }));
  const run = await runClaimComparison(elementInputs, technologyText, { model: getAnthropicModel() });
  const aiRunId = crypto.randomUUID();
  const sql = getRawSql(dbUrl);

  if (run.status === 'failed') {
    await sql.transaction((txn: TaggedSql) => [
      txn`insert into ai_runs (id, kind, status, target_type, target_id, model, prompt_version, params, input_hash, token_usage)
          values (${aiRunId}, 'claim_compare', 'failed', 'technology', ${technologyId}, ${run.model}, ${run.promptVersion}, ${toJsonbParam(run.params)}::jsonb, ${run.inputHash}, null)`,
      auditLogTxnStatement(txn, {
        actorUserId: me.id, action: 'ai_run', targetType: 'claim_analysis', targetId: patentId,
        result: 'failure', reason: 'ai_call_failed', meta: { error: run.error, technologyId }
      })
    ]);
    redirect(`${CLAIM_AGENT_PAGE}?compareError=ai_call_failed`);
  }

  if (run.status === 'invalid') {
    // ADR-0006ルール2: ai_citations が0件になるため、claim_analyses / claim_chart_rows
    // へは一切insertしない。
    await sql.transaction((txn: TaggedSql) => [
      txn`insert into ai_runs (id, kind, status, target_type, target_id, model, prompt_version, params, input_hash, token_usage)
          values (${aiRunId}, 'claim_compare', 'invalid', 'technology', ${technologyId}, ${run.model}, ${run.promptVersion}, ${toJsonbParam(run.params)}::jsonb, ${run.inputHash},
            ${run.tokenUsage ? toJsonbParam(run.tokenUsage) : null}::jsonb)`,
      auditLogTxnStatement(txn, {
        actorUserId: me.id, action: 'ai_run', targetType: 'claim_analysis', targetId: patentId,
        result: 'failure', reason: 'no_valid_citations', meta: { skippedCount: run.skipped.length, skipped: run.skipped, technologyId }
      })
    ]);
    redirect(`${CLAIM_AGENT_PAGE}?compareError=no_valid_rows`);
  }

  // succeeded: claim_analyses / claim_chart_rows と ai_citations（quoted_text は
  // technologyText から機械的に切り出し済み＝ run.rows[].quotedText）を原子的に書き込む。
  // our_text は自社案の該当文言そのもの（AIの自由記述ではなく quotedText と同一の
  // 機械抽出結果）とし、ADR-0006ルール1の対象を our_text/quoted_text の両方に及ぼす。
  const analysisId = crypto.randomUUID();
  const elementByLabel = new Map(elements.map(el => [el.label, el]));
  const rowsToInsert = run.rows.map(r => ({ id: crypto.randomUUID(), elementId: elementByLabel.get(r.elementLabel)!.id, ...r }));
  const citationRows = rowsToInsert.map(r => ({ id: crypto.randomUUID(), quotedText: r.quotedText }));

  await sql.transaction((txn: TaggedSql) => {
    const statements: Array<Promise<unknown>> = [
      txn`insert into claim_analyses (id, patent_id, technology_id) values (${analysisId}, ${patentId}, ${technologyId})`,
      txn`insert into ai_runs (id, kind, status, target_type, target_id, model, prompt_version, params, input_hash, token_usage)
          values (${aiRunId}, 'claim_compare', 'succeeded', 'technology', ${technologyId}, ${run.model}, ${run.promptVersion}, ${toJsonbParam(run.params)}::jsonb, ${run.inputHash},
            ${run.tokenUsage ? toJsonbParam(run.tokenUsage) : null}::jsonb)`
    ];
    for (const r of rowsToInsert) {
      statements.push(
        txn`insert into claim_chart_rows (id, analysis_id, seq, element_id, our_text, kind, rationale, quoted_text, char_start, char_end)
            values (${r.id}, ${analysisId}, ${r.seq}, ${r.elementId}, ${r.quotedText}, ${r.kind}, ${r.rationale}, ${r.quotedText}, ${r.charStart}, ${r.charEnd})`
      );
    }
    for (const c of citationRows) {
      statements.push(
        txn`insert into ai_citations (id, ai_run_id, source_type, source_id, quoted_text)
            values (${c.id}, ${aiRunId}, 'technology', ${technologyId}, ${c.quotedText})`
      );
    }
    statements.push(
      auditLogTxnStatement(txn, {
        actorUserId: me.id, action: 'ai_run', targetType: 'claim_analysis', targetId: analysisId,
        result: 'success',
        meta: {
          patentId, technologyId, rowCount: rowsToInsert.length, skippedCount: run.skipped.length,
          source: run.source, model: run.model
        }
      })
    );
    return statements;
  });

  revalidatePath(CLAIM_AGENT_PAGE);
  revalidatePath(`/patents/${patentId}`);
  redirect(`/claims/${analysisId}`);
}

export async function updateRowKind(formData: FormData) {
  const rowId = String(formData.get('rowId'));
  const analysisId = String(formData.get('analysisId'));
  const kind = String(formData.get('kind')) as 'match' | 'similar' | 'differ';

  const dbUrl = getDatabaseUrl();
  const db = getDb(dbUrl);
  // 利用者は認証Cookieから解決する（フォームの値は信用しない）
  const me = await requireCurrentDbUser(db);

  // 業務データ更新と監査ログ記録を原子的に行う（片方だけ成功する状態を防ぐ）
  const sql = getRawSql(dbUrl);
  await sql.transaction((txn) => [
    txn`update claim_chart_rows set kind = ${kind}, edited_by = ${me.id}, edited_at = now() where id = ${rowId}`,
    auditLogTxnStatement(txn, {
      actorUserId: me.id, action: 'update', targetType: 'claim_chart_row',
      targetId: rowId, result: 'success', meta: { kind }
    })
  ]);

  revalidatePath(`/claims/${analysisId}`);
}
