'use server';
// M48 Engineering Document Intelligence — Vision AI実接続（ユーザー承認済み）。
//
// 正とする文書:
// - docs/90-project/05-module-expansion-m26-m50.md（M48はM02/M03/M04/M09に依存）。
//   docs/10-requirements/05-rbac-matrix.md にM48専用の行が無いため、依存元モジュールに近い
//   技術系ロール（tech_manager, rnd, ip）に書込権限を揃える設計判断とした（詳細はPR本文）。
// - docs/20-architecture/adr/ADR-0006-provenance-first.md
//   画像・PDFからは原文の該当箇所を機械的に切り出せないため、ai_citations.quoted_text には
//   AIが生成した説明文をそのまま使わず、DBに実在し閲覧可能な検証可能情報（文書タイトル）を
//   用いる。ai_citations が0件になる場合（extracted_tech_elements が1件も採用できない場合）は
//   ai_runs.status='invalid' とし、extracted_tech_elements への insert も行わない（ルール2）。
// - document_element_patent_matches は、AIに直接特許検索させるのではなく、抽出済みの
//   element_label を用いて既存の字句検索基盤（lib/search/patent-match.ts、ADR-0003）で
//   関連特許候補を検索する（新たな高コストAI呼び出しを追加しない設計。理由はPR本文に明記）。
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
import { runTechElementsExtraction } from '@/lib/ai/tech-elements';
import { findPatentCandidatesForLabel } from '@/lib/search/patent-match';
import type { EngineeringDocType } from '@/lib/ai/client';
import type { DemoRole } from '@/lib/auth/demo';

// M48はM02(sites)/M03(users)/M04(patents)/M09(NETIS)に依存する。M48専用のRBAC行が
// rbac-matrix.mdに無いため、依存元に共通する技術系ロール（tech_manager, rnd, ip）に
// 書込権限を揃える（合理的な仮定。PR本文に明記）。
const ENGINEERING_DOC_WRITE_ROLES: ReadonlySet<DemoRole> = new Set<DemoRole>(['tech_manager', 'rnd', 'ip']);

const DOCUMENTS_LIST_PAGE = '/tech/bim-cim/documents';

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024; // 8MB（PDFはドローイング画像より大きくなりやすいため5MBよりやや広めに設定）
// cad/bimはバイナリ形式をAIで直接解析できないため、アップロード自体を受け付けない
// （engineering_documents.doc_type 自体はDB制約上 pdf/cad/bim/photo/sketch を許容するが、
// 本Server Actionはpdf/photo/sketchのみを受理する）。
const ALLOWED_DOC_TYPES: ReadonlySet<string> = new Set(['pdf', 'photo', 'sketch']);
const ALLOWED_MIME_BY_DOC_TYPE: Record<string, readonly string[]> = {
  pdf: ['application/pdf'],
  photo: ['image/png', 'image/jpeg', 'image/webp'],
  sketch: ['image/png', 'image/jpeg', 'image/webp']
};

function toJsonbParam(value: unknown): string {
  return JSON.stringify(value ?? {});
}

/**
 * 技術文書（pdf/photo/sketch）のファイルを受け取り、engineering_documents へ新規行を
 * 作成する（実ファイルは bytea 列 file_data に保存。report_files / patent_drawings と
 * 同じ方針。ADR-0007）。
 */
export async function uploadEngineeringDocumentAction(formData: FormData): Promise<void> {
  const docType = String(formData.get('docType') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const siteIdRaw = String(formData.get('siteId') ?? '').trim();
  const siteId = siteIdRaw || null;

  if (!title || !ALLOWED_DOC_TYPES.has(docType)) {
    redirect(`${DOCUMENTS_LIST_PAGE}?uploadError=missing_input`);
  }

  const dbUrl = getDatabaseUrl();
  const db = getDb(dbUrl);
  const me = await requireCurrentDbUser(db);

  if (!ENGINEERING_DOC_WRITE_ROLES.has(me.role as DemoRole)) {
    await logAudit(db, {
      actorUserId: me.id, action: 'upload', targetType: 'engineering_document',
      targetId: null, result: 'denied', reason: 'role_not_allowed', meta: { role: me.role }
    });
    redirect(`${DOCUMENTS_LIST_PAGE}?uploadError=role_not_allowed`);
  }

  if (siteId) {
    const [site] = await db.select({ id: s.sites.id }).from(s.sites).where(eq(s.sites.id, siteId)).limit(1);
    if (!site) {
      redirect(`${DOCUMENTS_LIST_PAGE}?uploadError=site_not_found`);
    }
  }

  const validated = await readValidatedUpload(formData.get('file'), {
    maxBytes: MAX_DOCUMENT_BYTES,
    allowedMimeTypes: ALLOWED_MIME_BY_DOC_TYPE[docType]!
  });
  if (!validated.ok) {
    await logAudit(db, {
      actorUserId: me.id, action: 'upload', targetType: 'engineering_document',
      targetId: null, result: 'failure', reason: validated.error, meta: { docType }
    });
    redirect(`${DOCUMENTS_LIST_PAGE}?uploadError=${validated.error}`);
  }

  const documentId = crypto.randomUUID();
  await db.insert(s.engineeringDocuments).values({
    id: documentId,
    docType,
    title,
    siteId,
    uploadedBy: me.id,
    isSample: false,
    fileData: validated.buffer,
    mimeType: validated.mimeType
  });

  await logAudit(db, {
    actorUserId: me.id, action: 'upload', targetType: 'engineering_document', targetId: documentId,
    result: 'success', meta: { docType, title, mimeType: validated.mimeType, byteSize: validated.buffer.byteLength }
  });

  revalidatePath(DOCUMENTS_LIST_PAGE);
  redirect(`/tech/bim-cim/documents/${documentId}`);
}

/**
 * 対象文書の file_data をVision AIへ渡し、技術要素を抽出して extracted_tech_elements へ
 * 書き込む。あわせて、抽出した要素ラベルで既存の字句検索基盤から関連特許候補を検索し、
 * document_element_patent_matches へ書き込む（新たな高コストAI呼び出しは追加しない）。
 * file_data が無い文書（デモデータ等）は「先にファイルをアップロードしてください」として
 * 拒否する。
 */
export async function extractTechElementsAction(formData: FormData): Promise<void> {
  const documentId = String(formData.get('documentId') ?? '').trim();
  if (!documentId) {
    redirect(`${DOCUMENTS_LIST_PAGE}?aiError=missing_input`);
  }

  const dbUrl = getDatabaseUrl();
  const db = getDb(dbUrl);
  const me = await requireCurrentDbUser(db);
  const detailPage = `/tech/bim-cim/documents/${documentId}`;

  if (!ENGINEERING_DOC_WRITE_ROLES.has(me.role as DemoRole)) {
    await logAudit(db, {
      actorUserId: me.id, action: 'ai_run', targetType: 'engineering_document',
      targetId: documentId, result: 'denied', reason: 'role_not_allowed', meta: { role: me.role }
    });
    redirect(`${detailPage}?aiError=role_not_allowed`);
  }

  const [doc] = await db.select().from(s.engineeringDocuments).where(eq(s.engineeringDocuments.id, documentId)).limit(1);
  if (!doc) {
    redirect(`${DOCUMENTS_LIST_PAGE}?aiError=document_not_found`);
  }
  if (!ALLOWED_DOC_TYPES.has(doc.docType)) {
    // cad/bim はアップロード導線自体で拒否しているため通常到達しないが、既存デモ行等への
    // 防御として明示的に拒否する。
    await logAudit(db, {
      actorUserId: me.id, action: 'ai_run', targetType: 'engineering_document',
      targetId: documentId, result: 'failure', reason: 'unsupported_doc_type', meta: { docType: doc.docType }
    });
    redirect(`${detailPage}?aiError=unsupported_doc_type`);
  }
  if (!doc.fileData || !doc.mimeType) {
    await logAudit(db, {
      actorUserId: me.id, action: 'ai_run', targetType: 'engineering_document',
      targetId: documentId, result: 'failure', reason: 'file_not_uploaded'
    });
    redirect(`${detailPage}?aiError=file_not_uploaded`);
  }

  const run = await runTechElementsExtraction(
    { data: Buffer.from(doc.fileData), mimeType: doc.mimeType, docType: doc.docType as EngineeringDocType },
    { title: doc.title },
    { model: getAnthropicModel() }
  );
  const aiRunId = crypto.randomUUID();
  const sql = getRawSql(dbUrl);

  if (run.status === 'failed') {
    await sql.transaction((txn: TaggedSql) => [
      txn`insert into ai_runs (id, kind, status, target_type, target_id, model, prompt_version, params, input_hash, token_usage)
          values (${aiRunId}, 'tech_elements_extract', 'failed', 'engineering_document', ${documentId}, ${run.model}, ${run.promptVersion}, ${toJsonbParam(run.params)}::jsonb, ${run.inputHash}, null)`,
      auditLogTxnStatement(txn, {
        actorUserId: me.id, action: 'ai_run', targetType: 'engineering_document', targetId: documentId,
        result: 'failure', reason: 'ai_call_failed', meta: { error: run.error }
      })
    ]);
    redirect(`${detailPage}?aiError=ai_call_failed`);
  }

  if (run.status === 'invalid') {
    // ADR-0006ルール2: ai_citations が0件になるため extracted_tech_elements へは一切insertしない。
    await sql.transaction((txn: TaggedSql) => [
      txn`insert into ai_runs (id, kind, status, target_type, target_id, model, prompt_version, params, input_hash, token_usage)
          values (${aiRunId}, 'tech_elements_extract', 'invalid', 'engineering_document', ${documentId}, ${run.model}, ${run.promptVersion}, ${toJsonbParam(run.params)}::jsonb, ${run.inputHash},
            ${run.tokenUsage ? toJsonbParam(run.tokenUsage) : null}::jsonb)`,
      auditLogTxnStatement(txn, {
        actorUserId: me.id, action: 'ai_run', targetType: 'engineering_document', targetId: documentId,
        result: 'failure', reason: 'no_valid_elements'
      })
    ]);
    redirect(`${detailPage}?aiError=no_valid_elements`);
  }

  // succeeded: extracted_tech_elements と ai_citations を書き込む前に、各要素ラベルで
  // 関連特許候補を検索しておく（トランザクション内で非同期の読み取りはできないため、
  // 書き込みの直前に読み取りを完了させる）。
  const elementRows = run.elements.map(el => ({ id: crypto.randomUUID(), ...el }));
  const matchesByElementId = new Map<string, Array<{ patentId: string; matchScore: number }>>();
  for (const el of elementRows) {
    const candidates = await findPatentCandidatesForLabel(db, el.elementLabel);
    if (candidates.length > 0) {
      matchesByElementId.set(el.id, candidates.map(c => ({ patentId: c.id, matchScore: c.score })));
    }
  }

  // quoted_text は AI の description をそのまま使わず、DBに実在する文書タイトルを使う
  // （ADR-0006: 画像・PDFからは原文の該当箇所を機械的に切り出せないための代替。
  //  設計判断はPR本文に明記）。
  const quotedText = doc.title;

  await sql.transaction((txn: TaggedSql) => {
    const statements: Array<Promise<unknown>> = [
      txn`insert into ai_runs (id, kind, status, target_type, target_id, model, prompt_version, params, input_hash, token_usage)
          values (${aiRunId}, 'tech_elements_extract', 'succeeded', 'engineering_document', ${documentId}, ${run.model}, ${run.promptVersion}, ${toJsonbParam(run.params)}::jsonb, ${run.inputHash},
            ${run.tokenUsage ? toJsonbParam(run.tokenUsage) : null}::jsonb)`
    ];
    for (const el of elementRows) {
      statements.push(
        txn`insert into extracted_tech_elements (id, document_id, element_label, description, confidence, is_sample)
            values (${el.id}, ${documentId}, ${el.elementLabel}, ${el.description}, ${el.confidence}, false)`
      );
      statements.push(
        txn`insert into ai_citations (id, ai_run_id, source_type, source_id, quoted_text)
            values (${crypto.randomUUID()}, ${aiRunId}, 'engineering_document', ${documentId}, ${quotedText})`
      );
      const matches = matchesByElementId.get(el.id) ?? [];
      for (const m of matches) {
        statements.push(
          txn`insert into document_element_patent_matches (id, element_id, patent_id, match_score, is_sample)
              values (${crypto.randomUUID()}, ${el.id}, ${m.patentId}, ${m.matchScore}, false)`
        );
      }
    }
    statements.push(
      auditLogTxnStatement(txn, {
        actorUserId: me.id, action: 'ai_run', targetType: 'engineering_document', targetId: documentId,
        result: 'success',
        meta: {
          elementCount: elementRows.length,
          matchCount: [...matchesByElementId.values()].reduce((sum, arr) => sum + arr.length, 0),
          source: run.source, model: run.model
        }
      })
    );
    return statements;
  });

  revalidatePath(detailPage);
  redirect(detailPage);
}
