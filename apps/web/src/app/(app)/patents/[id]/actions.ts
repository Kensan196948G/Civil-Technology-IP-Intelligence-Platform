'use server';
// FR-M06-002: 他社特許のClaim（請求項）をAIで構成要件に分解する Server Action。
//
// 正とする文書:
// - docs/10-requirements/05-rbac-matrix.md M06 Claim（W: tech_manager / ip のみ）
// - docs/20-architecture/adr/ADR-0006-provenance-first.md（quoted_text は機械的に切り出す。
//   ai_citations が0件の ai_runs は status='invalid' とし claim_elements へも反映しない）
//
// 重複実行時の扱い: 既に構成要件（claim_elements）が存在するClaimに対する再実行は
// 抑止する（denied: already_decomposed）。既存要素は claim_chart_rows.element_id から
// 参照されうる（M06 Claim比較機能、claim_chart_rows は claim_elements を
// ON DELETE 指定なしで参照）ため、削除して置き換える実装は参照整合性を壊す恐れがある。
// 再生成したい場合は将来的に「新しい分解結果を別バージョンとして追加し、
// 表示側で最新版を選ぶ」方式へ拡張することをバックログとする。
import { getDb } from '@/lib/db/client';
import { getRawSql, type TaggedSql } from '@/lib/db/raw';
import { getDatabaseUrl, getAnthropicModel } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireCurrentDbUser } from '@/lib/auth/require-user';
import { logAudit, auditLogTxnStatement } from '@/lib/audit/log';
import { runClaimDecomposition } from '@/lib/ai/claim-decompose';
import type { DemoRole } from '@/lib/auth/demo';

// RBAC §3 M06 Claim: R/W は tech_manager, ip のみ。
const CLAIM_DECOMPOSE_ROLES: ReadonlySet<DemoRole> = new Set<DemoRole>(['tech_manager', 'ip']);

function toJsonbParam(value: unknown): string {
  return JSON.stringify(value ?? {});
}

export async function decomposeClaim(formData: FormData): Promise<void> {
  const claimId = String(formData.get('claimId') ?? '').trim();
  const patentId = String(formData.get('patentId') ?? '').trim();
  if (!claimId || !patentId) return;

  const dbUrl = getDatabaseUrl();
  const db = getDb(dbUrl);
  // 実行者は認証Cookieから解決する（フォーム値は信用しない）
  const me = await requireCurrentDbUser(db);

  if (!CLAIM_DECOMPOSE_ROLES.has(me.role as DemoRole)) {
    await logAudit(db, {
      actorUserId: me.id, action: 'ai_run', targetType: 'patent_claim',
      targetId: claimId, result: 'denied', reason: 'role_not_allowed', meta: { role: me.role }
    });
    revalidatePath(`/patents/${patentId}`);
    return;
  }

  const [claim] = await db.select().from(s.patentClaims).where(eq(s.patentClaims.id, claimId)).limit(1);
  if (!claim) {
    await logAudit(db, {
      actorUserId: me.id, action: 'ai_run', targetType: 'patent_claim',
      targetId: claimId, result: 'failure', reason: 'claim_not_found'
    });
    revalidatePath(`/patents/${patentId}`);
    return;
  }

  const existing = await db.select({ id: s.claimElements.id }).from(s.claimElements).where(eq(s.claimElements.claimId, claimId)).limit(1);
  if (existing.length > 0) {
    await logAudit(db, {
      actorUserId: me.id, action: 'ai_run', targetType: 'patent_claim',
      targetId: claimId, result: 'denied', reason: 'already_decomposed'
    });
    revalidatePath(`/patents/${patentId}`);
    return;
  }

  const run = await runClaimDecomposition(claim.text, { model: getAnthropicModel() });
  const aiRunId = crypto.randomUUID();
  const sql = getRawSql(dbUrl);

  if (run.status === 'failed') {
    await sql.transaction((txn: TaggedSql) => [
      txn`insert into ai_runs (id, kind, status, target_type, target_id, model, prompt_version, params, input_hash, token_usage)
          values (${aiRunId}, 'claim_decompose', 'failed', 'patent_claim', ${claimId}, ${run.model}, ${run.promptVersion}, ${toJsonbParam(run.params)}::jsonb, ${run.inputHash}, null)`,
      auditLogTxnStatement(txn, {
        actorUserId: me.id, action: 'ai_run', targetType: 'patent_claim', targetId: claimId,
        result: 'failure', reason: 'ai_call_failed', meta: { error: run.error }
      })
    ]);
    revalidatePath(`/patents/${patentId}`);
    return;
  }

  if (run.status === 'invalid') {
    // ADR-0006ルール2: ai_citations が0件になるため、claim_elements へは一切insertしない。
    await sql.transaction((txn: TaggedSql) => [
      txn`insert into ai_runs (id, kind, status, target_type, target_id, model, prompt_version, params, input_hash, token_usage)
          values (${aiRunId}, 'claim_decompose', 'invalid', 'patent_claim', ${claimId}, ${run.model}, ${run.promptVersion}, ${toJsonbParam(run.params)}::jsonb, ${run.inputHash},
            ${run.tokenUsage ? toJsonbParam(run.tokenUsage) : null}::jsonb)`,
      auditLogTxnStatement(txn, {
        actorUserId: me.id, action: 'ai_run', targetType: 'patent_claim', targetId: claimId,
        result: 'failure', reason: 'no_valid_citations', meta: { skippedCount: run.skipped.length, skipped: run.skipped }
      })
    ]);
    revalidatePath(`/patents/${patentId}`);
    return;
  }

  // succeeded: claim_elements と ai_citations（quoted_text は claim.text から機械的に
  // 切り出し済み＝ run.elements[].text）を原子的に書き込む。
  const elementRows = run.elements.map(el => ({ ...el, id: crypto.randomUUID() }));
  const citationRows = elementRows.map(el => ({ id: crypto.randomUUID(), quotedText: el.text }));

  await sql.transaction((txn: TaggedSql) => {
    const statements: Array<Promise<unknown>> = [
      txn`insert into ai_runs (id, kind, status, target_type, target_id, model, prompt_version, params, input_hash, token_usage)
          values (${aiRunId}, 'claim_decompose', 'succeeded', 'patent_claim', ${claimId}, ${run.model}, ${run.promptVersion}, ${toJsonbParam(run.params)}::jsonb, ${run.inputHash},
            ${run.tokenUsage ? toJsonbParam(run.tokenUsage) : null}::jsonb)`
    ];
    for (const el of elementRows) {
      statements.push(
        txn`insert into claim_elements (id, claim_id, seq, label, text, char_start, char_end)
            values (${el.id}, ${claimId}, ${el.seq}, ${el.label}, ${el.text}, ${el.charStart}, ${el.charEnd})`
      );
    }
    for (const c of citationRows) {
      statements.push(
        txn`insert into ai_citations (id, ai_run_id, source_type, source_id, quoted_text)
            values (${c.id}, ${aiRunId}, 'patent_claim', ${claimId}, ${c.quotedText})`
      );
    }
    statements.push(
      auditLogTxnStatement(txn, {
        actorUserId: me.id, action: 'ai_run', targetType: 'patent_claim', targetId: claimId,
        result: 'success',
        meta: { elementCount: elementRows.length, skippedCount: run.skipped.length, source: run.source, model: run.model }
      })
    );
    return statements;
  });

  revalidatePath(`/patents/${patentId}`);
}
