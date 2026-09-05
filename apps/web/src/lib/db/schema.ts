// MVP用スキーマ。本番設計は docs/30-design/02-database-design.md を正とし、
// ここでは6画面の実動作に必要な最小サブセットのみを実装する。
import {
  pgTable, pgEnum, uuid, text, timestamp, integer, numeric, boolean, jsonb, date,
  type AnyPgColumn
} from 'drizzle-orm/pg-core';

export const classificationEnum = pgEnum('classification_t', ['C1', 'C2', 'C3', 'C4']);
export const roleEnum = pgEnum('role_t', [
  'engineer', 'tech_manager', 'rnd', 'ip', 'legal', 'executive', 'sysadmin', 'viewer'
]);
export const matchKindEnum = pgEnum('match_kind_t', ['match', 'similar', 'differ']);
export const workflowStatusEnum = pgEnum('workflow_status_t', [
  'draft', 'researching', 'ai_reviewed', 'technical_review', 'ip_review',
  'legal_review', 'approved', 'rejected', 'hold', 'archived'
]);

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull()
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  role: roleEnum('role').notNull(),
  departmentId: uuid('department_id').references(() => departments.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const patents = pgTable('patents', {
  id: uuid('id').primaryKey(),
  country: text('country').notNull(),
  publicationNo: text('publication_no'),
  title: text('title').notNull(),
  abstract: text('abstract'),
  applicantName: text('applicant_name').notNull(),
  applicationDate: date('application_date'),
  publicationDate: date('publication_date'),
  ipcCodes: text('ipc_codes').array().notNull().default([]),
  workTypes: text('work_types').array().notNull().default([]),
  classification: classificationEnum('classification').notNull().default('C1'),
  source: text('source').notNull(),
  sourceUrl: text('source_url'),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull(),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const patentClaims = pgTable('patent_claims', {
  id: uuid('id').primaryKey(),
  patentId: uuid('patent_id').notNull().references(() => patents.id, { onDelete: 'cascade' }),
  claimNo: integer('claim_no').notNull(),
  isIndependent: boolean('is_independent').notNull(),
  text: text('text').notNull()
});

export const claimElements = pgTable('claim_elements', {
  id: uuid('id').primaryKey(),
  claimId: uuid('claim_id').notNull().references(() => patentClaims.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  label: text('label').notNull(),
  text: text('text').notNull(),
  charStart: integer('char_start'),
  charEnd: integer('char_end')
});

// M26 Patent Citation Intelligence（第一拡張群・実装順位3）
// 特許間（後方/前方引用）と NPL（論文等）への引用関係。FR-M26-001/006。
export const patentCitations = pgTable('patent_citations', {
  id: uuid('id').primaryKey(),
  sourcePatentId: uuid('source_patent_id').notNull().references(() => patents.id),
  kind: text('kind').notNull(), // backward（後方引用）/ forward（前方引用）/ npl（非特許文献引用）
  citedPatentId: uuid('cited_patent_id').references(() => patents.id),
  citedPaperId: uuid('cited_paper_id').references(() => papers.id),
  note: text('note'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const papers = pgTable('papers', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  abstract: text('abstract'),
  venue: text('venue'),
  publishedOn: date('published_on'),
  source: text('source').notNull(),
  sourceUrl: text('source_url'),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull(),
  isSample: boolean('is_sample').notNull().default(true)
});

export const netisTechnologies = pgTable('netis_technologies', {
  id: uuid('id').primaryKey(),
  netisNo: text('netis_no').notNull().unique(),
  name: text('name').notNull(),
  summary: text('summary'),
  category: text('category'),
  registeredOn: date('registered_on'),
  source: text('source').notNull(),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull(),
  isSample: boolean('is_sample').notNull().default(true)
});

export const technologies = pgTable('technologies', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(), // technology / method / material / machine
  name: text('name').notNull(),
  summary: text('summary'),
  applicableConditions: jsonb('applicable_conditions').notNull().default({}),
  workTypes: text('work_types').array().notNull().default([]),
  maturity: text('maturity'),
  classification: classificationEnum('classification').notNull().default('C2'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M06 Claim Intelligence: 他社特許 vs 自社案の比較結果
export const claimAnalyses = pgTable('claim_analyses', {
  id: uuid('id').primaryKey(),
  patentId: uuid('patent_id').notNull().references(() => patents.id),
  technologyId: uuid('technology_id').notNull().references(() => technologies.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const claimChartRows = pgTable('claim_chart_rows', {
  id: uuid('id').primaryKey(),
  analysisId: uuid('analysis_id').notNull().references(() => claimAnalyses.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  elementId: uuid('element_id').notNull().references(() => claimElements.id),
  ourText: text('our_text').notNull(),
  kind: matchKindEnum('kind').notNull(),
  rationale: text('rationale'),
  quotedText: text('quoted_text').notNull(),
  charStart: integer('char_start'),
  charEnd: integer('char_end'),
  editedBy: uuid('edited_by').references(() => users.id),
  editedAt: timestamp('edited_at', { withTimezone: true })
});

// M13 現場適用性
export const sites = pgTable('sites', {
  id: uuid('id').primaryKey(),
  code: text('code').unique(),
  name: text('name').notNull(),
  workTypes: text('work_types').array().notNull().default([]),
  conditions: jsonb('conditions').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const siteIssues = pgTable('site_issues', {
  id: uuid('id').primaryKey(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  photos: text('photos').array().notNull().default([]),
  status: text('status').notNull().default('open'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const fieldApplications = pgTable('field_applications', {
  id: uuid('id').primaryKey(),
  siteIssueId: uuid('site_issue_id').notNull().references(() => siteIssues.id, { onDelete: 'cascade' }),
  candidateType: text('candidate_type').notNull(), // technology / netis
  candidateId: uuid('candidate_id').notNull(),
  score: numeric('score', { precision: 5, scale: 2 }).notNull(),
  axes: jsonb('axes').notNull(),
  blockers: jsonb('blockers').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M15/M22 発明・ワークフロー
export const inventions = pgTable('inventions', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  summary: text('summary'),
  siteId: uuid('site_id').references(() => sites.id),
  classification: classificationEnum('classification').notNull().default('C3'),
  submittedBy: uuid('submitted_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const workflowInstances = pgTable('workflow_instances', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(), // invention / field_adoption / license_in
  subjectType: text('subject_type').notNull(),
  subjectId: uuid('subject_id').notNull(),
  title: text('title').notNull(),
  status: workflowStatusEnum('status').notNull().default('draft'),
  classification: classificationEnum('classification').notNull().default('C2'),
  authorId: uuid('author_id').notNull().references(() => users.id),
  dueOn: date('due_on'),
  humanCheckRequired: boolean('human_check_required').notNull().default(false),
  humanCheckCompletedAt: timestamp('human_check_completed_at', { withTimezone: true }),
  aiRiskSummary: jsonb('ai_risk_summary'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey(),
  instanceId: uuid('instance_id').notNull().references(() => workflowInstances.id, { onDelete: 'cascade' }),
  approverId: uuid('approver_id').notNull().references(() => users.id),
  decision: text('decision').notNull(), // approved / rejected / hold
  comment: text('comment'),
  decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow()
});

// M24/根拠追跡（簡略版）
export const aiRuns = pgTable('ai_runs', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(),
  status: text('status').notNull().default('succeeded'),
  targetType: text('target_type'),
  targetId: uuid('target_id'),
  model: text('model').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const aiCitations = pgTable('ai_citations', {
  id: uuid('id').primaryKey(),
  aiRunId: uuid('ai_run_id').notNull().references(() => aiRuns.id, { onDelete: 'cascade' }),
  sourceType: text('source_type').notNull(),
  sourceId: uuid('source_id').notNull(),
  quotedText: text('quoted_text').notNull(),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull().defaultNow()
});

// M25 監査ログ（追記専用）
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: uuid('target_id'),
  result: text('result').notNull(),
  reason: text('reason'),
  meta: jsonb('meta').notNull().default({})
});

// ナビゲーション全項目（20セクション）を画面化するために追加した最小サブセット。
// 既存エンティティ（patents/technologies/papers/netis/workflowInstances/aiRuns/auditLogs）で
// 表現できる画面は新テーブルを作らず、フィルタ済み一覧として実装する。

export const researchers = pgTable('researchers', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  affiliation: text('affiliation'),
  field: text('field'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const competitors = pgTable('competitors', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const investigations = pgTable('investigations', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  query: text('query').notNull(),
  status: text('status').notNull().default('open'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M36 PoC / Experiment Management（第一拡張群・実装順位7）
// 仮説 → 実証 → 結果 → 採用/中止 を管理する。詳細は docs/90-project/06-first-wave-fr-drafts.md（FR-M36）。
export const pocExperiments = pgTable('poc_experiments', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  hypothesis: text('hypothesis').notNull(),               // 何を改善するか
  kpis: jsonb('kpis').notNull().default({}),              // KPI（工数/品質/安全/CO₂等。キーと目標値）
  beforeMethod: text('before_method'),                    // Before: 従来工法
  afterMethod: text('after_method'),                      // After: 新技術・新工法
  costYen: integer('cost_yen'),                           // 実証費（円）
  result: text('result').notNull().default('planned'),    // planned / running / success / partial_success / failed / abandoned
  lesson: text('lesson'),                                 // 得られた知見（失敗PoCも資産として記録）
  siteIssueId: uuid('site_issue_id').references(() => siteIssues.id), // 起点の現場課題（導線 M13）
  createdBy: uuid('created_by').notNull().references(() => users.id),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M28 FTO / Clearance Intelligence（第一拡張群・実装順位1）
// FTO 予備調査：対象の技術構成要素ごとに他社 Claim と照合する。FR-M28-001〜006。
export const ftoCases = pgTable('fto_cases', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),                       // 対象技術・工法の概要
  status: text('status').notNull().default('draft'),      // draft / in_review / completed / closed
  createdBy: uuid('created_by').notNull().references(() => users.id),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const ftoComponents = pgTable('fto_components', {
  id: uuid('id').primaryKey(),
  ftoCaseId: uuid('fto_case_id').notNull().references(() => ftoCases.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),                          // 構成要素の並び（A,B,C…）
  label: text('label').notNull(),                         // 構成の識別子（A：制御装置 等）
  description: text('description'),                       // 構成の説明
  relatedPatentId: uuid('related_patent_id').references(() => patents.id),
  claimNo: text('claim_no'),                              // 照合した請求項
  aiSimilarity: integer('ai_similarity'),                 // AI類似度（0-100。侵害判断ではない）
  actionLevel: text('action_level').notNull().default('none'), // must_review / confirm / reference / none
  note: text('note'),                                     // 専門確認コメント等
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M27 Patent Prosecution / Dossier Intelligence（第一拡張群・実装順位2）
// 特許庁審査経過（出願→審査請求→拒絶理由→補正→意見書→登録）の時系列イベント。FR-M27-001/002/005。
export const prosecutionEvents = pgTable('prosecution_events', {
  id: uuid('id').primaryKey(),
  patentId: uuid('patent_id').notNull().references(() => patents.id),
  occurredOn: date('occurred_on').notNull(),              // イベント発生日
  kind: text('kind').notNull(),                           // application / exam_request / rejection / amendment / opinion / registration / other
  description: text('description').notNull(),             // 内容（拒絶理由の要旨・補正内容等）
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M29 IP Entity Intelligence（第一拡張群・実装順位4）
// 出願人・権利者・機関の名寄せと企業グループ。FR-M29-001〜005。
export const ipEntities = pgTable('ip_entities', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(),                           // company / institution / person / group
  canonicalName: text('canonical_name').notNull(),        // 正規名（表示・集計の基準）
  country: text('country'),
  parentEntityId: uuid('parent_entity_id').references((): AnyPgColumn => ipEntities.id), // 企業グループ（親）
  note: text('note'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const entityAliases = pgTable('entity_aliases', {
  id: uuid('id').primaryKey(),
  entityId: uuid('entity_id').notNull().references(() => ipEntities.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull().unique(),                // 表記ゆれ（例: 株式会社ABC / ABC CONSTRUCTION CO.,LTD.）
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const watches = pgTable('watches', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(), // patent / competitor / technology / ipc / researcher / paper / netis
  label: text('label').notNull(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const licenses = pgTable('licenses', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(), // license_in / license_out
  counterpartName: text('counterpart_name').notNull(),
  subjectType: text('subject_type').notNull(), // patent / technology / netis
  subjectId: uuid('subject_id').notNull(),
  status: text('status').notNull().default('candidate'),
  terms: jsonb('terms').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  format: text('format').notNull().default('html'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const featureFlags = pgTable('feature_flags', {
  id: uuid('id').primaryKey(),
  key: text('key').notNull().unique(),
  enabled: boolean('enabled').notNull().default(false),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull().default({}),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// M33 Technology Knowledge Graph（第一拡張群・実装順位5）
// 特許・論文・NETIS・技術・会社・研究者・現場を結ぶ汎用リンク。
// 種別ごとにテーブルが分かれるため、source/target は種別文字列＋ID のポリモーフィック参照とする
// （DDL では外部キーを張れないため、アプリ層で存在チェックする。FR-M33-001/002/004）。
export const kgEdges = pgTable('kg_edges', {
  id: uuid('id').primaryKey(),
  sourceKind: text('source_kind').notNull(),  // patent / paper / netis / technology / company / researcher / site
  sourceId: uuid('source_id').notNull(),
  relation: text('relation').notNull(),       // related_to / cites / owns / registered_as / applied_at / studied_in / developed_by
  targetKind: text('target_kind').notNull(),
  targetId: uuid('target_id').notNull(),
  note: text('note'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M30 Claim Evolution Intelligence（第一拡張群・実装順位11）
// Claim の版（出願時→拒絶理由対応後→登録時）を保持し、差分表示・限定要素の抽出に使う。FR-M30-001〜005。
export const claimVersions = pgTable('claim_versions', {
  id: uuid('id').primaryKey(),
  patentId: uuid('patent_id').notNull().references(() => patents.id, { onDelete: 'cascade' }),
  claimNo: integer('claim_no').notNull(),
  versionKind: text('version_kind').notNull(), // as_filed（出願時）/ after_amendment（補正後）/ as_registered（登録時）
  text: text('text').notNull(),
  changedElements: jsonb('changed_elements').notNull().default([]), // 前版から追加・限定された要素（AI抽出・デモ）
  note: text('note'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M32 IP Value & Quality Intelligence（第一拡張群・実装順位12）
// 特許ごとの評価要素スコア（技術力・権利強度・市場性・競合重要性・現場適用性・残存期間・コスト）と
// Strategic Score、検討候補（維持/ライセンス/追加出願/共同研究/売却/放棄）。FR-M32-001〜004。
export const ipValueScores = pgTable('ip_value_scores', {
  id: uuid('id').primaryKey(),
  patentId: uuid('patent_id').notNull().unique().references(() => patents.id, { onDelete: 'cascade' }),
  evaluatedOn: date('evaluated_on').notNull().defaultNow(),
  elements: jsonb('elements').notNull().default({}),       // {technology, patent_strength, market, competitor, field_applicability, remaining_life, cost}（各0-100）
  weights: jsonb('weights').notNull().default({}),         // 要素ごとの重み（既定は画面側定数）
  strategicScore: numeric('strategic_score', { precision: 5, scale: 2 }).notNull(),
  basis: jsonb('basis').notNull().default({}),             // 要素ごとのスコア根拠
  candidates: jsonb('candidates').notNull().default([]),   // 検討候補 {action, reason}
  evaluatedBy: uuid('evaluated_by').references(() => users.id),
  note: text('note'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M31 Advanced Patent Family Intelligence（第一拡張群・実装順位6）
// 同一発明の各国出願（優先権→PCT→各国移行、分割・継続）をファミリーとして構造化し、
// 各国の権利状態・残存期間・Claim差を比較する。FR-M31-001〜004。
export const patentFamilies = pgTable('patent_families', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),                 // ファミリー名（例: ケーソン据付技術ファミリー）
  note: text('note'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const patentFamilyMembers = pgTable('patent_family_members', {
  id: uuid('id').primaryKey(),
  familyId: uuid('family_id').notNull().references(() => patentFamilies.id, { onDelete: 'cascade' }),
  patentId: uuid('patent_id').notNull().references(() => patents.id, { onDelete: 'cascade' }),
  memberKind: text('member_kind').notNull(), // priority（優先権出願）/ pct（PCT出願）/ national_phase（各国移行）/ divisional（分割）/ continuation（継続）
  note: text('note'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M34 Standards & Specification Intelligence（第一拡張群・実装順位6）
// JIS・ISO・国交省要領・設計/施工基準・発注仕様・安全基準の台帳と版管理、技術との関連付け。
// FR-M34-001（台帳・版管理）/003（技術⇔規格の関連）/004（収集元・版の記録）。
export const standards = pgTable('standards', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(),           // jis / iso / mlit_manual（国交省要領・基準）/ spec（発注仕様）/ safety（安全基準）
  code: text('code').notNull(),           // 規格番号（例: JIS A 5308 / ISO 9001）
  title: text('title').notNull(),
  summary: text('summary'),
  version: text('version'),               // 版（例: 2023 / Rev.5）
  issuedOn: date('issued_on'),            // 制定・発効日
  source: text('source').notNull(),       // 収集元（JIS ハンドブック等）
  sourceUrl: text('source_url'),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull(),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// 技術⇔規格の関連（適用可否の判断メモを添えられる）
export const technologyStandards = pgTable('technology_standards', {
  id: uuid('id').primaryKey(),
  technologyId: uuid('technology_id').notNull().references(() => technologies.id, { onDelete: 'cascade' }),
  standardId: uuid('standard_id').notNull().references(() => standards.id, { onDelete: 'cascade' }),
  applicability: text('applicability').notNull(), // applicable / conditional / not_applicable / under_review
  memo: text('memo'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M38 Safety & Quality Intelligence（第一拡張群・実装順位8）
// 新技術導入前の安全・品質リスク候補を、類似事故・不具合事例・安全基準等から集めて提示し、
// M22 承認ワークフローの安全ゲートへつなぐ。FR-M38-001〜004。
export const safetyReviews = pgTable('safety_reviews', {
  id: uuid('id').primaryKey(),
  technologyId: uuid('technology_id').notNull().references(() => technologies.id, { onDelete: 'cascade' }),
  // リスク候補（JSON: 種別・内容・根拠の出典を必ず添付。FR-M38-003）
  risks: jsonb('risks').notNull().default([]),
  // 参照した類似事故・不具合事例・安全基準（JSON で出典を保存）
  sources: jsonb('sources').notNull().default([]),
  // 安全ゲート結果（承認ワークフロー連携用。FR-M38-002）
  gateStatus: text('gate_status').notNull().default('pending'), // pending / in_review / cleared / blocked
  gateReviewedBy: uuid('gate_reviewed_by').references(() => users.id),
  gateReviewedAt: timestamp('gate_reviewed_at', { withTimezone: true }),
  gateComment: text('gate_comment'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M45 Innovation Opportunity Intelligence（第一拡張群・実装順位9）
// 研究テーマ候補を、White Space・現場ニーズ・競合強度・論文増加率・NETIS・市場性・
// Safety・GX・難易度の入力要素からスコアリングしランキング提示する。FR-M45-001〜004。
export const innovationOpportunities = pgTable('innovation_opportunities', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),                 // 研究テーマ候補
  description: text('description'),
  // 入力要素（0-100。根拠は basis に記録）
  factors: jsonb('factors').notNull().default({}),
  basis: jsonb('basis').notNull().default({}),    // 要素ごとの根拠
  opportunityScore: numeric('opportunity_score', { precision: 5, scale: 2 }).notNull(),
  status: text('status').notNull().default('candidate'), // candidate / shortlisted / decided / rejected
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M49 AI Governance & Evaluation（第一拡張群・実装順位10）
// AI 実行の品質を評価するための記録: Model・Prompt版・Skill版・検索クエリ・参照ドキュメント数
// （ai_runs/ai_citations は Provenance＝根拠の保持、こちらは評価メタ＝ガバナンス）。
// FR-M49-001（実行メタの記録）/002（Coverage/Confidence/Hallucination/Human Review）
// /003（モデル比較）/004（再現性）/005（ダッシュボード）。
export const aiEvaluations = pgTable('ai_evaluations', {
  id: uuid('id').primaryKey(),
  aiRunId: uuid('ai_run_id').notNull().unique().references(() => aiRuns.id, { onDelete: 'cascade' }),
  promptVersion: text('prompt_version'),
  skillVersion: text('skill_version'),
  searchQuery: text('search_query'),
  referencedDocs: integer('referenced_docs').notNull().default(0),
  citationCoverage: numeric('citation_coverage', { precision: 5, scale: 2 }).notNull(), // 0-100%
  confidence: numeric('confidence', { precision: 4, scale: 2 }),                        // 0-1
  hallucinationChecked: boolean('hallucination_checked').notNull().default(false),
  hallucinationFlagged: boolean('hallucination_flagged').notNull().default(false),
  humanReviewed: boolean('human_reviewed').notNull().default(false),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  note: text('note'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M50 Technology Ontology / Taxonomy Management（第二拡張群）
// 工種・工法・構造物・材料・機械・IPC/CPC・NETIS分類を1つの階層ツリーで管理し、
// 全モジュールの検索精度を底上げする。parent_id で階層を表現する。
export const ontologyTerms = pgTable('ontology_terms', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(),            // work_type / work_method / structure / material / machine / ipc / netis_category
  code: text('code'),                      // 規格コード・分類番号（IPC/CPC/NETIS区分 等）
  name: text('name').notNull(),
  parentId: uuid('parent_id'),             // 自己参照（DDL で制約定義）
  depth: integer('depth').notNull().default(0), // ルート=0
  note: text('note'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M35 Technology Readiness Intelligence（第二拡張群）
// 技術の成熟度（TRL 1-9相当）・実証状況・施工実績・導入難易度を管理し、
// 現場導入の判断材料を提供する。technologies.maturity の高度化。
export const trlAssessments = pgTable('trl_assessments', {
  id: uuid('id').primaryKey(),
  technologyId: uuid('technology_id').notNull().references(() => technologies.id, { onDelete: 'cascade' }),
  trl: integer('trl').notNull(),               // 1-9（1:原理発見 〜 9:実用実績）
  levelLabel: text('level_label').notNull(),   // 例: 実証段階 / 実用化段階
  evidence: jsonb('evidence').notNull().default([]), // 判定根拠（PoC・施工実績・論文等の出典）
  nextStep: text('next_step'),                 // 次段階への所要事項
  assessedOn: date('assessed_on').notNull(),
  assessedBy: uuid('assessed_by').references(() => users.id),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M37 Technology Business Case Intelligence（第二拡張群）
// 技術導入の費用対効果（導入費・削減工数・ROI・TCO・Payback）を管理し、
// M32 IP Value とセットで経営判断を支援する。
export const businessCases = pgTable('business_cases', {
  id: uuid('id').primaryKey(),
  technologyId: uuid('technology_id').notNull().references(() => technologies.id, { onDelete: 'cascade' }),
  capexYen: integer('capex_yen'),                  // 導入費
  annualSavingsYen: integer('annual_savings_yen'), // 年間削減額（工数・燃料等）
  laborHoursSavedPerYear: integer('labor_hours_saved_per_year'),
  roiPct: numeric('roi_pct', { precision: 5, scale: 2 }),
  tco5yYen: integer('tco5y_yen'),                  // 5年TCO
  paybackYears: numeric('payback_years', { precision: 4, scale: 1 }),
  baselineMethod: text('baseline_method'),         // Before（従来工法）
  basis: jsonb('basis').notNull().default({}),     // 計算根拠
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M39 GX / Environmental Intelligence（第二拡張群）
// 従来工法と新技術を比較した CO2・燃料・資材・廃棄物・省人化の定量化。
// GX（グリーントランスフォーメーション）推進の判断材料。
export const gxComparisons = pgTable('gx_comparisons', {
  id: uuid('id').primaryKey(),
  technologyId: uuid('technology_id').notNull().references(() => technologies.id, { onDelete: 'cascade' }),
  baselineMethod: text('baseline_method').notNull(),   // 従来工法（Before）
  co2ReductionPct: numeric('co2_reduction_pct', { precision: 5, scale: 2 }),
  co2ReductionTonPerYear: numeric('co2_reduction_ton_per_year', { precision: 8, scale: 2 }),
  fuelSavingsPct: numeric('fuel_savings_pct', { precision: 5, scale: 2 }),
  materialSavingsPct: numeric('material_savings_pct', { precision: 5, scale: 2 }),
  wasteReductionPct: numeric('waste_reduction_pct', { precision: 5, scale: 2 }),
  laborReductionPct: numeric('labor_reduction_pct', { precision: 5, scale: 2 }),
  basis: jsonb('basis').notNull().default({}),   // 計算根拠（LCA手法・出典）
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M40 BIM/CIM Technology Intelligence（第二拡張群）
// IFC/BIM/CIM オブジェクトと工法・特許・NETIS・技術の関連付け。
// 施工計画・4Dシミュレーションでの技術適用を支援。
export const bimCimLinks = pgTable('bim_cim_links', {
  id: uuid('id').primaryKey(),
  // 対象（ポリモーフィック: technology / patent / netis / site）
  subjectType: text('subject_type').notNull(), // technology / patent / netis / site
  subjectId: uuid('subject_id').notNull(),
  ifcEntity: text('ifc_entity').notNull(),     // IFCエンティティ（例: IfcWall, IfcSlab）
  elementName: text('element_name'),           // 要素名（例: 防波堤ケーソン・A1）
  modelName: text('model_name'),               // モデル名
  note: text('note'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M43 Competitive Signal Intelligence（第二拡張群）
// 特許以外の競合兆候（論文・ニュース・採用情報・技術発表・共同研究等）を
// 時系列で検知し、M10 Competitor Intelligence / M19 Watch を強化する。
export const competitiveSignals = pgTable('competitive_signals', {
  id: uuid('id').primaryKey(),
  competitorId: uuid('competitor_id').references(() => competitors.id),
  competitorName: text('competitor_name').notNull(),
  kind: text('kind').notNull(),          // paper / news / hiring / joint_research / product_launch / award / funding
  title: text('title').notNull(),
  summary: text('summary'),
  strength: text('strength').notNull().default('medium'), // low / medium / high
  detectedOn: date('detected_on').notNull(),
  source: text('source').notNull(),
  sourceUrl: text('source_url'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M44 Technology Transfer Pipeline（第二拡張群）
// 技術獲得・供与の案件を Buy/Build/Partner/License/Joint-R&D モードで管理する。
export const transferCases = pgTable('transfer_cases', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  mode: text('mode').notNull(),           // buy / build / partner / license / joint_rd
  direction: text('direction').notNull(), // inbound / outbound
  counterpartName: text('counterpart_name').notNull(),
  subjectSummary: text('subject_summary'),
  status: text('status').notNull().default('scouting'), // scouting / evaluating / negotiating / agreed / abandoned
  terms: jsonb('terms').notNull().default({}),
  note: text('note'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M41 Research Partner Intelligence（第二拡張群）
// 大学・研究機関・企業・Startup・研究者のネットワークを管理し、
// 共同研究の候補発掘と連携状況の俯瞰を提供する。
export const researchPartners = pgTable('research_partners', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(),          // university / research_institute / company / startup
  name: text('name').notNull(),
  field: text('field'),                  // 専門分野
  collaborationStatus: text('collaboration_status').notNull().default('none'), // none / exploring / joint_research / nda / contract
  contactPerson: text('contact_person'),
  note: text('note'),
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// M46 Multilingual Patent Intelligence（第二拡張群）
// 特許の多言語翻訳（日英中韓）を管理し、Claim 対訳・専門用語辞書の土台を提供する。
export const patentTranslations = pgTable('patent_translations', {
  id: uuid('id').primaryKey(),
  patentId: uuid('patent_id').notNull().references(() => patents.id, { onDelete: 'cascade' }),
  language: text('language').notNull(),  // ja / en / zh / ko / de / fr
  title: text('title').notNull(),
  abstract: text('abstract'),
  claim1Text: text('claim1_text'),
  provider: text('provider').notNull(),  // deepseek / claude / human / jpo_machine
  qualityFlag: text('quality_flag').notNull().default('draft'), // draft / reviewed / certified
  isSample: boolean('is_sample').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
