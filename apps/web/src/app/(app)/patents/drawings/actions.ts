'use server';
// M47 Patent Drawing / Image Intelligence — Vision AI実接続（ユーザー承認済み）。
//
// 正とする文書:
// - docs/10-requirements/05-rbac-matrix.md M04 Patent / M06 Claim（W: tech_manager, ip）。
//   patent_drawings は M04/M06 に依存するモジュールのため、書込権限は既存の
//   generateClaimComparison（claims/actions.ts）と同じロールに揃える。
// - docs/20-architecture/adr/ADR-0006-provenance-first.md
//   画像からは原文の該当箇所を機械的に切り出せないため、ai_citations.quoted_text には
//   AIが生成した部品説明文をそのまま使わず、DBに実在し閲覧可能な検証可能情報
//   （図番 figure_no・キャプション caption）を用いる（実装上の必須ルール1相当の代替）。
//   ai_citations が0件になる場合（drawing_parts が1件も採用できない場合）は
//   ai_runs.status='invalid' とし、drawing_parts への insert も行わない（ルール2）。
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { getRawSql, type TaggedSql } from '@/lib/db/raw';
import { getDatabaseUrl, getAnthropicModel } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';
import { requireCurrentDbUser } from '@/lib/auth/require-user';
import { logAudit, auditLogTxnStatement } from '@/lib/audit/log';
import { readValidatedUpload } from '@/lib/uploads/validate';
import { runDrawingPartsExtraction } from '@/lib/ai/drawing-parts';
import type { SupportedImageMimeType } from '@/lib/ai/client';
import type { DemoRole } from '@/lib/auth/demo';
import { ne, inArray } from 'drizzle-orm';
import { embedTexts, isVoyageConfigured } from '@/lib/ai/embeddings';
import { buildDrawingCompareText, jaccardSimilarity, cosineSimilarity, toSimilarityScore } from '@/lib/search/drawing-similarity';

// RBAC §3 M04 Patent / M06 Claim: R/W は tech_manager, ip のみ。
const DRAWING_WRITE_ROLES: ReadonlySet<DemoRole> = new Set<DemoRole>(['tech_manager', 'ip']);

const DRAWINGS_LIST_PAGE = '/patents/drawings';

const MAX_DRAWING_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

function toJsonbParam(value: unknown): string {
  return JSON.stringify(value ?? {});
}

/**
 * 対象特許・図番・画像ファイルを受け取り、patent_drawings へ新規行を作成する
 * （実画像は bytea 列 image_data に保存。report_files と同じ方針。ADR-0007）。
 */
export async function uploadDrawingImageAction(formData: FormData): Promise<void> {
  const patentId = String(formData.get('patentId') ?? '').trim();
  const figureNo = String(formData.get('figureNo') ?? '').trim();
  const captionRaw = String(formData.get('caption') ?? '').trim();
  const caption = captionRaw || null;

  if (!patentId || !figureNo) {
    redirect(`${DRAWINGS_LIST_PAGE}?uploadError=missing_input`);
  }

  const dbUrl = getDatabaseUrl();
  const db = getDb(dbUrl);
  const me = await requireCurrentDbUser(db);

  if (!DRAWING_WRITE_ROLES.has(me.role as DemoRole)) {
    await logAudit(db, {
      actorUserId: me.id, action: 'upload', targetType: 'patent_drawing',
      targetId: patentId, result: 'denied', reason: 'role_not_allowed', meta: { role: me.role }
    });
    redirect(`${DRAWINGS_LIST_PAGE}?uploadError=role_not_allowed`);
  }

  const [patent] = await db.select({ id: s.patents.id }).from(s.patents).where(eq(s.patents.id, patentId)).limit(1);
  if (!patent) {
    redirect(`${DRAWINGS_LIST_PAGE}?uploadError=patent_not_found`);
  }

  const validated = await readValidatedUpload(formData.get('file'), {
    maxBytes: MAX_DRAWING_IMAGE_BYTES,
    allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES
  });
  if (!validated.ok) {
    await logAudit(db, {
      actorUserId: me.id, action: 'upload', targetType: 'patent_drawing',
      targetId: patentId, result: 'failure', reason: validated.error
    });
    redirect(`${DRAWINGS_LIST_PAGE}?uploadError=${validated.error}`);
  }

  const drawingId = crypto.randomUUID();
  await db.insert(s.patentDrawings).values({
    id: drawingId,
    patentId,
    figureNo,
    caption,
    isSample: false,
    imageData: validated.buffer,
    mimeType: validated.mimeType
  });

  await logAudit(db, {
    actorUserId: me.id, action: 'upload', targetType: 'patent_drawing', targetId: drawingId,
    result: 'success', meta: { patentId, figureNo, mimeType: validated.mimeType, byteSize: validated.buffer.byteLength }
  });

  revalidatePath(DRAWINGS_LIST_PAGE);
  redirect(`/patents/drawings/${drawingId}`);
}

/**
 * 対象図面の image_data をVision AIへ渡し、部品（符号・説明）を認識して
 * drawing_parts へ書き込む。image_data が無い図面（デモデータ等）は
 * 「先に画像をアップロードしてください」として拒否する。
 */
export async function extractDrawingPartsAction(formData: FormData): Promise<void> {
  const drawingId = String(formData.get('drawingId') ?? '').trim();
  if (!drawingId) {
    redirect(`${DRAWINGS_LIST_PAGE}?aiError=missing_input`);
  }

  const dbUrl = getDatabaseUrl();
  const db = getDb(dbUrl);
  const me = await requireCurrentDbUser(db);
  const detailPage = `/patents/drawings/${drawingId}`;

  if (!DRAWING_WRITE_ROLES.has(me.role as DemoRole)) {
    await logAudit(db, {
      actorUserId: me.id, action: 'ai_run', targetType: 'patent_drawing',
      targetId: drawingId, result: 'denied', reason: 'role_not_allowed', meta: { role: me.role }
    });
    redirect(`${detailPage}?aiError=role_not_allowed`);
  }

  const [drawing] = await db.select().from(s.patentDrawings).where(eq(s.patentDrawings.id, drawingId)).limit(1);
  if (!drawing) {
    redirect(`${DRAWINGS_LIST_PAGE}?aiError=drawing_not_found`);
  }
  if (!drawing.imageData || !drawing.mimeType) {
    await logAudit(db, {
      actorUserId: me.id, action: 'ai_run', targetType: 'patent_drawing',
      targetId: drawingId, result: 'failure', reason: 'image_not_uploaded'
    });
    redirect(`${detailPage}?aiError=image_not_uploaded`);
  }

  const run = await runDrawingPartsExtraction(
    { data: Buffer.from(drawing.imageData), mimeType: drawing.mimeType as SupportedImageMimeType },
    { figureNo: drawing.figureNo, caption: drawing.caption },
    { model: getAnthropicModel() }
  );
  const aiRunId = crypto.randomUUID();
  const sql = getRawSql(dbUrl);

  if (run.status === 'failed') {
    await sql.transaction((txn: TaggedSql) => [
      txn`insert into ai_runs (id, kind, status, target_type, target_id, model, prompt_version, params, input_hash, token_usage)
          values (${aiRunId}, 'drawing_parts_extract', 'failed', 'patent_drawing', ${drawingId}, ${run.model}, ${run.promptVersion}, ${toJsonbParam(run.params)}::jsonb, ${run.inputHash}, null)`,
      auditLogTxnStatement(txn, {
        actorUserId: me.id, action: 'ai_run', targetType: 'patent_drawing', targetId: drawingId,
        result: 'failure', reason: 'ai_call_failed', meta: { error: run.error }
      })
    ]);
    redirect(`${detailPage}?aiError=ai_call_failed`);
  }

  if (run.status === 'invalid') {
    // ADR-0006ルール2: ai_citations が0件になるため drawing_parts へは一切insertしない。
    await sql.transaction((txn: TaggedSql) => [
      txn`insert into ai_runs (id, kind, status, target_type, target_id, model, prompt_version, params, input_hash, token_usage)
          values (${aiRunId}, 'drawing_parts_extract', 'invalid', 'patent_drawing', ${drawingId}, ${run.model}, ${run.promptVersion}, ${toJsonbParam(run.params)}::jsonb, ${run.inputHash},
            ${run.tokenUsage ? toJsonbParam(run.tokenUsage) : null}::jsonb)`,
      auditLogTxnStatement(txn, {
        actorUserId: me.id, action: 'ai_run', targetType: 'patent_drawing', targetId: drawingId,
        result: 'failure', reason: 'no_valid_parts'
      })
    ]);
    redirect(`${detailPage}?aiError=no_valid_parts`);
  }

  // succeeded: drawing_parts と ai_citations を原子的に書き込む。
  // quoted_text は AI の description をそのまま使わず、DBに実在する図番・キャプションを使う
  // （ADR-0006: 画像からは原文の該当箇所を機械的に切り出せないための代替。設計判断はPR本文に明記）。
  const quotedText = drawing.caption ? `${drawing.figureNo} / ${drawing.caption}` : drawing.figureNo;
  const partRows = run.parts.map(p => ({ id: crypto.randomUUID(), ...p }));

  await sql.transaction((txn: TaggedSql) => {
    const statements: Array<Promise<unknown>> = [
      txn`insert into ai_runs (id, kind, status, target_type, target_id, model, prompt_version, params, input_hash, token_usage)
          values (${aiRunId}, 'drawing_parts_extract', 'succeeded', 'patent_drawing', ${drawingId}, ${run.model}, ${run.promptVersion}, ${toJsonbParam(run.params)}::jsonb, ${run.inputHash},
            ${run.tokenUsage ? toJsonbParam(run.tokenUsage) : null}::jsonb)`
    ];
    for (const p of partRows) {
      statements.push(
        txn`insert into drawing_parts (id, drawing_id, part_no, description, is_sample)
            values (${p.id}, ${drawingId}, ${p.partNo}, ${p.description}, false)`
      );
      statements.push(
        txn`insert into ai_citations (id, ai_run_id, source_type, source_id, quoted_text)
            values (${crypto.randomUUID()}, ${aiRunId}, 'patent_drawing', ${drawingId}, ${quotedText})`
      );
    }
    statements.push(
      auditLogTxnStatement(txn, {
        actorUserId: me.id, action: 'ai_run', targetType: 'patent_drawing', targetId: drawingId,
        result: 'success', meta: { partCount: partRows.length, source: run.source, model: run.model }
      })
    );
    return statements;
  });

  revalidatePath(detailPage);
  redirect(detailPage);
}

// 類似図面検索（drawing_similarities）。画像ペアごとのVision AI比較は組合せ爆発
// （N枚でN^2回のAI呼び出し）になるため対応せず、既に抽出済みの drawing_parts（符号・
// 説明文）とcaptionのテキスト類似度で代替する（新規のAI画像解析呼び出しを増やさない）。
// VOYAGE_API_KEY設定時はVoyage AI埋め込みのコサイン類似度、未設定時は依存なしで動く
// 字句類似度（Jaccard係数）へフォールバックする（lib/ai/embeddings.ts と同じ設計思想）。
const MAX_SIMILARITY_CANDIDATES = 200;
const TOP_SIMILAR_DRAWINGS = 5;
const MIN_SIMILARITY_RATIO = 0.05; // 5%未満はノイズとして記録しない

export async function calculateDrawingSimilaritiesAction(formData: FormData): Promise<void> {
  const drawingId = String(formData.get('drawingId') ?? '').trim();
  if (!drawingId) {
    redirect(`${DRAWINGS_LIST_PAGE}?aiError=missing_input`);
  }

  const dbUrl = getDatabaseUrl();
  const db = getDb(dbUrl);
  const me = await requireCurrentDbUser(db);
  const detailPage = `/patents/drawings/${drawingId}`;

  if (!DRAWING_WRITE_ROLES.has(me.role as DemoRole)) {
    await logAudit(db, {
      actorUserId: me.id, action: 'compute_similarity', targetType: 'patent_drawing',
      targetId: drawingId, result: 'denied', reason: 'role_not_allowed', meta: { role: me.role }
    });
    redirect(`${detailPage}?aiError=role_not_allowed`);
  }

  const [drawing] = await db.select().from(s.patentDrawings).where(eq(s.patentDrawings.id, drawingId)).limit(1);
  if (!drawing) {
    redirect(`${DRAWINGS_LIST_PAGE}?aiError=drawing_not_found`);
  }

  const targetParts = await db.select({ partNo: s.drawingParts.partNo, description: s.drawingParts.description })
    .from(s.drawingParts).where(eq(s.drawingParts.drawingId, drawingId));
  const targetText = buildDrawingCompareText(drawing.caption, targetParts);
  if (!targetText.trim()) {
    await logAudit(db, {
      actorUserId: me.id, action: 'compute_similarity', targetType: 'patent_drawing',
      targetId: drawingId, result: 'failure', reason: 'no_compare_text'
    });
    redirect(`${detailPage}?aiError=no_compare_text`);
  }

  const candidates = await db.select({
    id: s.patentDrawings.id, caption: s.patentDrawings.caption
  }).from(s.patentDrawings).where(ne(s.patentDrawings.id, drawingId)).limit(MAX_SIMILARITY_CANDIDATES);

  const candidateIds = candidates.map(c => c.id);
  const candidateParts = candidateIds.length
    ? await db.select({ drawingId: s.drawingParts.drawingId, partNo: s.drawingParts.partNo, description: s.drawingParts.description })
        .from(s.drawingParts).where(inArray(s.drawingParts.drawingId, candidateIds))
    : [];
  const partsByDrawing = new Map<string, { partNo: string; description: string }[]>();
  for (const part of candidateParts) {
    const list = partsByDrawing.get(part.drawingId) ?? [];
    list.push({ partNo: part.partNo, description: part.description });
    partsByDrawing.set(part.drawingId, list);
  }
  const candidateTexts = candidates.map(c => buildDrawingCompareText(c.caption, partsByDrawing.get(c.id) ?? []));

  let ratios: number[];
  let method: 'voyage_embedding' | 'lexical_jaccard';
  if (isVoyageConfigured()) {
    const [targetEmbedding, ...candidateEmbeddings] = await embedTexts([targetText, ...candidateTexts], { inputType: 'document' });
    if (targetEmbedding) {
      method = 'voyage_embedding';
      ratios = candidateEmbeddings.map(emb => emb ? Math.max(0, cosineSimilarity(targetEmbedding, emb)) : 0);
    } else {
      // API呼び出し失敗時は字句類似度へフォールバックする（例外を投げず処理を継続する既存方針に合わせる）。
      method = 'lexical_jaccard';
      ratios = candidateTexts.map(text => jaccardSimilarity(targetText, text));
    }
  } else {
    method = 'lexical_jaccard';
    ratios = candidateTexts.map(text => jaccardSimilarity(targetText, text));
  }

  const ranked = candidates
    .map((c, i) => ({ id: c.id, ratio: ratios[i] ?? 0 }))
    .filter(r => r.ratio >= MIN_SIMILARITY_RATIO)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, TOP_SIMILAR_DRAWINGS);

  const dbUrlForTxn = dbUrl;
  const sql = getRawSql(dbUrlForTxn);
  await sql.transaction((txn: TaggedSql) => {
    const statements: Array<Promise<unknown>> = [
      // 再計算のたびに既存の記録を洗い替える（idempotent）。
      txn`delete from drawing_similarities where drawing_id = ${drawingId}`
    ];
    for (const r of ranked) {
      statements.push(
        txn`insert into drawing_similarities (id, drawing_id, similar_drawing_id, similarity_score, is_sample)
            values (${crypto.randomUUID()}, ${drawingId}, ${r.id}, ${toSimilarityScore(r.ratio)}, false)`
      );
    }
    statements.push(
      auditLogTxnStatement(txn, {
        actorUserId: me.id, action: 'compute_similarity', targetType: 'patent_drawing', targetId: drawingId,
        result: 'success', meta: { method, candidateCount: candidates.length, matchCount: ranked.length }
      })
    );
    return statements;
  });

  revalidatePath(detailPage);
  redirect(detailPage);
}
