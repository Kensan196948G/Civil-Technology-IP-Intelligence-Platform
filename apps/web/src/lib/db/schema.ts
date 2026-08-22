// MVP用スキーマ。本番設計は docs/30-design/02-database-design.md を正とし、
// ここでは6画面の実動作に必要な最小サブセットのみを実装する。
import {
  pgTable, pgEnum, uuid, text, timestamp, integer, numeric, boolean, jsonb, date
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
