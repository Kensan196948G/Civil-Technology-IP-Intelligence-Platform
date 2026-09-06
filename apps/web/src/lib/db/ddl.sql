CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE classification_t AS ENUM ('C1','C2','C3','C4');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE role_t AS ENUM ('engineer','tech_manager','rnd','ip','legal','executive','sysadmin','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE match_kind_t AS ENUM ('match','similar','differ');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE workflow_status_t AS ENUM
    ('draft','researching','ai_reviewed','technical_review','ip_review','legal_review','approved','rejected','hold','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role role_t NOT NULL,
  department_id uuid REFERENCES departments(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patents (
  id uuid PRIMARY KEY,
  country text NOT NULL,
  publication_no text,
  title text NOT NULL,
  abstract text,
  applicant_name text NOT NULL,
  application_date date,
  publication_date date,
  ipc_codes text[] NOT NULL DEFAULT '{}',
  work_types text[] NOT NULL DEFAULT '{}',
  classification classification_t NOT NULL DEFAULT 'C1',
  source text NOT NULL,
  source_url text,
  retrieved_at timestamptz NOT NULL,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patent_claims (
  id uuid PRIMARY KEY,
  patent_id uuid NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
  claim_no integer NOT NULL,
  is_independent boolean NOT NULL,
  text text NOT NULL
);

CREATE TABLE IF NOT EXISTS claim_elements (
  id uuid PRIMARY KEY,
  claim_id uuid NOT NULL REFERENCES patent_claims(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  label text NOT NULL,
  text text NOT NULL,
  char_start integer,
  char_end integer
);

CREATE TABLE IF NOT EXISTS papers (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  abstract text,
  venue text,
  published_on date,
  source text NOT NULL,
  source_url text,
  retrieved_at timestamptz NOT NULL,
  is_sample boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS netis_technologies (
  id uuid PRIMARY KEY,
  netis_no text NOT NULL UNIQUE,
  name text NOT NULL,
  summary text,
  category text,
  registered_on date,
  source text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  is_sample boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS technologies (
  id uuid PRIMARY KEY,
  kind text NOT NULL,
  name text NOT NULL,
  summary text,
  applicable_conditions jsonb NOT NULL DEFAULT '{}',
  work_types text[] NOT NULL DEFAULT '{}',
  maturity text,
  classification classification_t NOT NULL DEFAULT 'C2',
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claim_analyses (
  id uuid PRIMARY KEY,
  patent_id uuid NOT NULL REFERENCES patents(id),
  technology_id uuid NOT NULL REFERENCES technologies(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claim_chart_rows (
  id uuid PRIMARY KEY,
  analysis_id uuid NOT NULL REFERENCES claim_analyses(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  element_id uuid NOT NULL REFERENCES claim_elements(id),
  our_text text NOT NULL,
  kind match_kind_t NOT NULL,
  rationale text,
  quoted_text text NOT NULL,
  char_start integer,
  char_end integer,
  edited_by uuid REFERENCES users(id),
  edited_at timestamptz
);

CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY,
  code text UNIQUE,
  name text NOT NULL,
  work_types text[] NOT NULL DEFAULT '{}',
  conditions jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_issues (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  body text NOT NULL,
  photos text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS field_applications (
  id uuid PRIMARY KEY,
  site_issue_id uuid NOT NULL REFERENCES site_issues(id) ON DELETE CASCADE,
  candidate_type text NOT NULL,
  candidate_id uuid NOT NULL,
  score numeric(5,2) NOT NULL,
  axes jsonb NOT NULL,
  blockers jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventions (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  summary text,
  site_id uuid REFERENCES sites(id),
  classification classification_t NOT NULL DEFAULT 'C3',
  submitted_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_instances (
  id uuid PRIMARY KEY,
  kind text NOT NULL,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  title text NOT NULL,
  status workflow_status_t NOT NULL DEFAULT 'draft',
  classification classification_t NOT NULL DEFAULT 'C2',
  author_id uuid NOT NULL REFERENCES users(id),
  due_on date,
  human_check_required boolean NOT NULL DEFAULT false,
  human_check_completed_at timestamptz,
  ai_risk_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES users(id),
  decision text NOT NULL,
  comment text,
  decided_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_runs (
  id uuid PRIMARY KEY,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'succeeded',
  target_type text,
  target_id uuid,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_citations (
  id uuid PRIMARY KEY,
  ai_run_id uuid NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  quoted_text text NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  target_type text,
  target_id uuid,
  result text NOT NULL,
  reason text,
  meta jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS researchers (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  affiliation text,
  field text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitors (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  category text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS investigations (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  query text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watches (
  id uuid PRIMARY KEY,
  kind text NOT NULL,
  label text NOT NULL,
  owner_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY,
  kind text NOT NULL,
  counterpart_name text NOT NULL,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'candidate',
  terms jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY,
  kind text NOT NULL,
  title text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  format text NOT NULL DEFAULT 'html',
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'success'
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY,
  key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patents_title ON patents (title);
CREATE INDEX IF NOT EXISTS idx_technologies_name ON technologies (name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred ON audit_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_status ON workflow_instances (status);

-- M36 PoC / Experiment Management（第一拡張群・実装順位7）
CREATE TABLE IF NOT EXISTS poc_experiments (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  hypothesis text NOT NULL,
  kpis jsonb NOT NULL DEFAULT '{}',
  before_method text,
  after_method text,
  cost_yen integer,
  result text NOT NULL DEFAULT 'planned',
  lesson text,
  site_issue_id uuid REFERENCES site_issues(id),
  created_by uuid NOT NULL REFERENCES users(id),
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_poc_experiments_created ON poc_experiments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_poc_experiments_result ON poc_experiments (result);

-- M26 Patent Citation Intelligence（第一拡張群・実装順位3）
CREATE TABLE IF NOT EXISTS patent_citations (
  id uuid PRIMARY KEY,
  source_patent_id uuid NOT NULL REFERENCES patents(id),
  kind text NOT NULL CHECK (kind IN ('backward','forward','npl')),
  cited_patent_id uuid REFERENCES patents(id),
  cited_paper_id uuid REFERENCES papers(id),
  note text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cited_patent_id IS NOT NULL OR cited_paper_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_patent_citations_source ON patent_citations (source_patent_id);
CREATE INDEX IF NOT EXISTS idx_patent_citations_cited_patent ON patent_citations (cited_patent_id);
CREATE INDEX IF NOT EXISTS idx_patent_citations_kind ON patent_citations (kind);

-- M28 FTO / Clearance Intelligence（第一拡張群・実装順位1）
CREATE TABLE IF NOT EXISTS fto_cases (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','completed','closed')),
  created_by uuid NOT NULL REFERENCES users(id),
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fto_components (
  id uuid PRIMARY KEY,
  fto_case_id uuid NOT NULL REFERENCES fto_cases(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  label text NOT NULL,
  description text,
  related_patent_id uuid REFERENCES patents(id),
  claim_no text,
  ai_similarity integer CHECK (ai_similarity >= 0 AND ai_similarity <= 100),
  action_level text NOT NULL DEFAULT 'none' CHECK (action_level IN ('must_review','confirm','reference','none')),
  note text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fto_cases_status ON fto_cases (status);
CREATE INDEX IF NOT EXISTS idx_fto_components_case ON fto_components (fto_case_id, seq);

-- M27 Patent Prosecution / Dossier Intelligence（第一拡張群・実装順位2）
CREATE TABLE IF NOT EXISTS prosecution_events (
  id uuid PRIMARY KEY,
  patent_id uuid NOT NULL REFERENCES patents(id),
  occurred_on date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('application','exam_request','rejection','amendment','opinion','registration','other')),
  description text NOT NULL,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prosecution_patent_date ON prosecution_events (patent_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_prosecution_kind ON prosecution_events (kind);

-- M29 IP Entity Intelligence（第一拡張群・実装順位4）
CREATE TABLE IF NOT EXISTS ip_entities (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('company','institution','person','group')),
  canonical_name text NOT NULL,
  country text,
  parent_entity_id uuid REFERENCES ip_entities(id),
  note text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS entity_aliases (
  id uuid PRIMARY KEY,
  entity_id uuid NOT NULL REFERENCES ip_entities(id) ON DELETE CASCADE,
  alias text NOT NULL UNIQUE,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_alias ON entity_aliases (alias);
CREATE INDEX IF NOT EXISTS idx_ip_entities_parent ON ip_entities (parent_entity_id);

-- M33 Technology Knowledge Graph（第一拡張群・実装順位5）
-- 特許・論文・NETIS・技術・会社・研究者・現場を結ぶ汎用リンク（ポリモーフィック参照）。
-- source/target は「種別文字列＋UUID」。種別ごとに実テーブルが分かれるため外部キーは張らない。
-- 整合はアプリ層で担保し、表示名の解決は画面側で行う。FR-M33-001/002/004。
CREATE TABLE IF NOT EXISTS kg_edges (
  id uuid PRIMARY KEY,
  source_kind text NOT NULL CHECK (source_kind IN ('patent','paper','netis','technology','company','researcher','site')),
  source_id uuid NOT NULL,
  relation text NOT NULL CHECK (relation IN ('related_to','cites','owns','registered_as','applied_at','studied_in','developed_by')),
  target_kind text NOT NULL CHECK (target_kind IN ('patent','paper','netis','technology','company','researcher','site')),
  target_id uuid NOT NULL,
  note text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_kind <> target_kind OR source_id <> target_id)
);
CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON kg_edges (source_kind, source_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON kg_edges (target_kind, target_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_relation ON kg_edges (relation);

-- M30 Claim Evolution Intelligence（第一拡張群・実装順位11）
-- Claim の版スナップショット（出願時→補正後→登録時）。changed_elements は前版から追加・限定された要素。
-- FR-M30-001（版の構造化保持）/002（差分）/003（限定要素抽出の素材）/005（法的評価は行わない）。
CREATE TABLE IF NOT EXISTS claim_versions (
  id uuid PRIMARY KEY,
  patent_id uuid NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
  claim_no integer NOT NULL,
  version_kind text NOT NULL CHECK (version_kind IN ('as_filed','after_amendment','as_registered')),
  text text NOT NULL,
  changed_elements jsonb NOT NULL DEFAULT '[]',
  note text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patent_id, claim_no, version_kind)
);
CREATE INDEX IF NOT EXISTS idx_claim_versions_patent ON claim_versions (patent_id, claim_no);

-- M32 IP Value & Quality Intelligence（第一拡張群・実装順位12）
-- 特許ごとの評価要素スコアと戦略スコア。FR-M32-001（要素管理）/002（統合スコア）/003（検討候補）。
CREATE TABLE IF NOT EXISTS ip_value_scores (
  id uuid PRIMARY KEY,
  patent_id uuid NOT NULL UNIQUE REFERENCES patents(id) ON DELETE CASCADE,
  evaluated_on date NOT NULL DEFAULT now(),
  elements jsonb NOT NULL DEFAULT '{}',
  weights jsonb NOT NULL DEFAULT '{}',
  strategic_score numeric(5,2) NOT NULL,
  basis jsonb NOT NULL DEFAULT '{}',
  candidates jsonb NOT NULL DEFAULT '[]',
  evaluated_by uuid REFERENCES users(id),
  note text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ip_value_scores_strategic ON ip_value_scores (strategic_score DESC);

-- M31 Advanced Patent Family Intelligence（第一拡張群・実装順位6）
-- 同一発明の各国出願をファミリーとして保持し、優先権→PCT→各国移行・分割・継続の関係を管理する。
-- FR-M31-001（ツリー）/002（国別権利状態・残存期間）/003（Claim差・戦略）。
CREATE TABLE IF NOT EXISTS patent_families (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  note text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS patent_family_members (
  id uuid PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES patent_families(id) ON DELETE CASCADE,
  patent_id uuid NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
  member_kind text NOT NULL CHECK (member_kind IN ('priority','pct','national_phase','divisional','continuation')),
  note text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patent_family_members_family ON patent_family_members (family_id);
CREATE INDEX IF NOT EXISTS idx_patent_family_members_patent ON patent_family_members (patent_id);

-- M34 Standards & Specification Intelligence（第一拡張群・実装順位6）
-- 規格台帳（JIS/ISO/国交省要領・設計施工基準/発注仕様/安全基準）と技術⇔規格の関連。FR-M34-001/003/004。
CREATE TABLE IF NOT EXISTS standards (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('jis','iso','mlit_manual','spec','safety')),
  code text NOT NULL,
  title text NOT NULL,
  summary text,
  version text,
  issued_on date,
  source text NOT NULL,
  source_url text,
  retrieved_at timestamptz NOT NULL,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_standards_kind ON standards (kind);
CREATE INDEX IF NOT EXISTS idx_standards_code ON standards (code);

CREATE TABLE IF NOT EXISTS technology_standards (
  id uuid PRIMARY KEY,
  technology_id uuid NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  standard_id uuid NOT NULL REFERENCES standards(id) ON DELETE CASCADE,
  applicability text NOT NULL CHECK (applicability IN ('applicable','conditional','not_applicable','under_review')),
  memo text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_technology_standards_tech ON technology_standards (technology_id);
CREATE INDEX IF NOT EXISTS idx_technology_standards_std ON technology_standards (standard_id);

-- M38 Safety & Quality Intelligence（第一拡張群・実装順位8）
-- 新技術導入前の安全ゲート。リスク候補とその出典を保持し、承認ワークフローへ連携する。
-- FR-M38-001（リスク収集）/002（M22安全ゲート）/003（根拠の出典必須）/004（最終判断は安全・品質担当者）。
CREATE TABLE IF NOT EXISTS safety_reviews (
  id uuid PRIMARY KEY,
  technology_id uuid NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  risks jsonb NOT NULL DEFAULT '[]',
  sources jsonb NOT NULL DEFAULT '[]',
  gate_status text NOT NULL DEFAULT 'pending' CHECK (gate_status IN ('pending','in_review','cleared','blocked')),
  gate_reviewed_by uuid REFERENCES users(id),
  gate_reviewed_at timestamptz,
  gate_comment text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_safety_reviews_tech ON safety_reviews (technology_id);
CREATE INDEX IF NOT EXISTS idx_safety_reviews_gate ON safety_reviews (gate_status);

-- M45 Innovation Opportunity Intelligence（第一拡張群・実装順位9）
-- 研究テーマ候補の機会スコアリング。FR-M45-001（入力要素管理）/002（ランキング提示）/003（決定は人）。
CREATE TABLE IF NOT EXISTS innovation_opportunities (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  description text,
  factors jsonb NOT NULL DEFAULT '{}',
  basis jsonb NOT NULL DEFAULT '{}',
  opportunity_score numeric(5,2) NOT NULL,
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','shortlisted','decided','rejected')),
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_innovation_opportunities_score ON innovation_opportunities (opportunity_score DESC);

-- M49 AI Governance & Evaluation（第一拡張群・実装順位10）
-- AI実行の品質評価メタ（Prompt版/Skill版/検索クエリ/Coverage/Confidence/Hallucination/Human Review）。
-- Provenance（ai_runs/ai_citations＝根拠の保持）とは別に、ガバナンス用の評価を記録する。
-- FR-M49-001〜005。
CREATE TABLE IF NOT EXISTS ai_evaluations (
  id uuid PRIMARY KEY,
  ai_run_id uuid NOT NULL UNIQUE REFERENCES ai_runs(id) ON DELETE CASCADE,
  prompt_version text,
  skill_version text,
  search_query text,
  referenced_docs integer NOT NULL DEFAULT 0,
  citation_coverage numeric(5,2) NOT NULL,
  confidence numeric(4,2),
  hallucination_checked boolean NOT NULL DEFAULT false,
  hallucination_flagged boolean NOT NULL DEFAULT false,
  human_reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  note text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_evaluations_run ON ai_evaluations (ai_run_id);
CREATE INDEX IF NOT EXISTS idx_ai_evaluations_coverage ON ai_evaluations (citation_coverage DESC);

-- M50 Technology Ontology / Taxonomy Management（第二拡張群）
-- 工種・工法・構造物・材料・機械・IPC/CPC・NETIS分類の体系管理（自己参照階層）。
-- 全モジュールの検索・分類の基盤（M12 civil_classifications の発展形）。
CREATE TABLE IF NOT EXISTS ontology_terms (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('work_type','work_method','structure','material','machine','ipc','netis_category')),
  code text,
  name text NOT NULL,
  parent_id uuid REFERENCES ontology_terms(id) ON DELETE CASCADE,
  depth integer NOT NULL DEFAULT 0,
  note text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ontology_terms_parent ON ontology_terms (parent_id);
CREATE INDEX IF NOT EXISTS idx_ontology_terms_kind ON ontology_terms (kind);

-- M35 Technology Readiness Intelligence（第二拡張群）
-- 技術の成熟度（TRL）・実証状況・判定根拠を管理。M03-004 の高度化。
CREATE TABLE IF NOT EXISTS trl_assessments (
  id uuid PRIMARY KEY,
  technology_id uuid NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  trl integer NOT NULL CHECK (trl >= 1 AND trl <= 9),
  level_label text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]',
  next_step text,
  assessed_on date NOT NULL,
  assessed_by uuid REFERENCES users(id),
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trl_assessments_tech ON trl_assessments (technology_id);
CREATE INDEX IF NOT EXISTS idx_trl_assessments_trl ON trl_assessments (trl);

-- M37 Technology Business Case Intelligence（第二拡張群）
-- 技術導入の費用対効果。M32 IP Value とセットで経営判断を支援。
CREATE TABLE IF NOT EXISTS business_cases (
  id uuid PRIMARY KEY,
  technology_id uuid NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  capex_yen integer,
  annual_savings_yen integer,
  labor_hours_saved_per_year integer,
  roi_pct numeric(5,2),
  tco5y_yen integer,
  payback_years numeric(4,1),
  baseline_method text,
  basis jsonb NOT NULL DEFAULT '{}',
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_business_cases_tech ON business_cases (technology_id);
CREATE INDEX IF NOT EXISTS idx_business_cases_roi ON business_cases (roi_pct DESC);

-- M39 GX / Environmental Intelligence（第二拡張群）
-- 従来工法と新技術の CO2・燃料・資材・廃棄物・省人化の定量化比較。
CREATE TABLE IF NOT EXISTS gx_comparisons (
  id uuid PRIMARY KEY,
  technology_id uuid NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  baseline_method text NOT NULL,
  co2_reduction_pct numeric(5,2),
  co2_reduction_ton_per_year numeric(8,2),
  fuel_savings_pct numeric(5,2),
  material_savings_pct numeric(5,2),
  waste_reduction_pct numeric(5,2),
  labor_reduction_pct numeric(5,2),
  basis jsonb NOT NULL DEFAULT '{}',
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gx_comparisons_tech ON gx_comparisons (technology_id);
CREATE INDEX IF NOT EXISTS idx_gx_comparisons_co2 ON gx_comparisons (co2_reduction_ton_per_year DESC);

-- M40 BIM/CIM Technology Intelligence（第二拡張群）
-- IFC/BIM/CIM オブジェクトと技術・特許・NETIS・現場の関連付け。
CREATE TABLE IF NOT EXISTS bim_cim_links (
  id uuid PRIMARY KEY,
  subject_type text NOT NULL CHECK (subject_type IN ('technology','patent','netis','site')),
  subject_id uuid NOT NULL,
  ifc_entity text NOT NULL,
  element_name text,
  model_name text,
  note text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bim_cim_links_subject ON bim_cim_links (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_bim_cim_links_ifc ON bim_cim_links (ifc_entity);

-- M43 Competitive Signal Intelligence（第二拡張群）
-- 特許以外の競合兆候を時系列で検知（M10/M19 の強化）。
CREATE TABLE IF NOT EXISTS competitive_signals (
  id uuid PRIMARY KEY,
  competitor_id uuid REFERENCES competitors(id),
  competitor_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('paper','news','hiring','joint_research','product_launch','award','funding')),
  title text NOT NULL,
  summary text,
  strength text NOT NULL DEFAULT 'medium' CHECK (strength IN ('low','medium','high')),
  detected_on date NOT NULL,
  source text NOT NULL,
  source_url text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_competitive_signals_detected ON competitive_signals (detected_on DESC);
CREATE INDEX IF NOT EXISTS idx_competitive_signals_kind ON competitive_signals (kind);

-- M44 Technology Transfer Pipeline（第二拡張群）
-- 技術獲得・供与の案件（Buy/Build/Partner/License/Joint-R&D）。
CREATE TABLE IF NOT EXISTS transfer_cases (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('buy','build','partner','license','joint_rd')),
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  counterpart_name text NOT NULL,
  subject_summary text,
  status text NOT NULL DEFAULT 'scouting' CHECK (status IN ('scouting','evaluating','negotiating','agreed','abandoned')),
  terms jsonb NOT NULL DEFAULT '{}',
  note text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transfer_cases_status ON transfer_cases (status);
CREATE INDEX IF NOT EXISTS idx_transfer_cases_mode ON transfer_cases (mode);

-- M41 Research Partner Intelligence（第二拡張群）
-- 大学・研究機関・企業・Startup・研究者のネットワーク管理。
CREATE TABLE IF NOT EXISTS research_partners (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('university','research_institute','company','startup')),
  name text NOT NULL,
  field text,
  collaboration_status text NOT NULL DEFAULT 'none' CHECK (collaboration_status IN ('none','exploring','joint_research','nda','contract')),
  contact_person text,
  note text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_research_partners_kind ON research_partners (kind);
CREATE INDEX IF NOT EXISTS idx_research_partners_status ON research_partners (collaboration_status);

-- M46 Multilingual Patent Intelligence（第二拡張群）
-- 特許の多言語翻訳（日英中韓ほか）を管理し、Claim 対訳の土台を提供。
CREATE TABLE IF NOT EXISTS patent_translations (
  id uuid PRIMARY KEY,
  patent_id uuid NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
  language text NOT NULL,
  title text NOT NULL,
  abstract text,
  claim1_text text,
  provider text NOT NULL,
  quality_flag text NOT NULL DEFAULT 'draft' CHECK (quality_flag IN ('draft','reviewed','certified')),
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patent_translations_patent ON patent_translations (patent_id);
CREATE INDEX IF NOT EXISTS idx_patent_translations_lang ON patent_translations (language);

-- M42 R&D Funding Intelligence（第二拡張群）
-- NEDO・JST・SIP・BRIDGE等の研究助成制度台帳と、研究テーマ（technologies）とのマッチング。
-- 依存: M14 R&D Intelligence。研究テーマは既存の technologies テーブルをそのまま用いる（新テーブル化しない）。
-- ロールバック: DROP TABLE IF EXISTS funding_matches; DROP TABLE IF EXISTS funding_programs;
-- （funding_matches → funding_programs の順で削除。他テーブルからの参照なし）
CREATE TABLE IF NOT EXISTS funding_programs (
  id uuid PRIMARY KEY,
  agency text NOT NULL,
  name text NOT NULL,
  summary text,
  field text,
  amount_range text,
  application_deadline date,
  source_url text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_funding_programs_agency ON funding_programs (agency);

CREATE TABLE IF NOT EXISTS funding_matches (
  id uuid PRIMARY KEY,
  funding_program_id uuid NOT NULL REFERENCES funding_programs(id) ON DELETE CASCADE,
  technology_id uuid NOT NULL REFERENCES technologies(id),
  match_score numeric(5,2) NOT NULL,
  rationale text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_funding_matches_program ON funding_matches (funding_program_id);
CREATE INDEX IF NOT EXISTS idx_funding_matches_technology ON funding_matches (technology_id);

-- FR-M06-002 AI Claim分解: ai_runs に ADR-0006「実装上の必須ルール2」
-- （model / prompt_version / params / input_hash / token_usage を必ず記録する）に
-- 必要な列を追加する。加算のみ・既存列は変更しない（後方互換）。
-- ロールバック: 下記4列を DROP COLUMN すれば元に戻せる（他テーブルからの参照なし）。
ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS prompt_version text;
ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS params jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS input_hash text;
ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS token_usage jsonb;

-- ADR-0003 / docs/30-design/06-search-and-rag-design.md 字句検索（pg_trgm）基盤。
-- 意味検索（pgvector）は埋め込みモデル・次元数が未確定（docs/40-infrastructure/02-neon-setup.md）のため
-- 本マイグレーションのスコープ外（見送り）。ここでは①構造検索の強化と②字句検索（トライグラム類似）の
-- 基盤のみを additive に追加する。全て IF NOT EXISTS / CREATE OR REPLACE で再実行安全。
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- text_norm 相当の正規化関数。設計書§3の正規化のうち、Postgres標準関数のみで実現できる範囲
-- （全角英数字→半角、大文字小文字統一、連続空白の圧縮）を IMMUTABLE 関数として実装し、
-- 生成列（GENERATED ALWAYS AS ... STORED）から呼び出す。
-- 注: 完全なUnicode NFKC正規化・半角カナ→全角カナ変換・長音/波ダッシュの統一は
-- Postgres標準関数だけでは行えないため未実装（⚠️ 将来 unaccent 等の追加拡張やアプリ側の
-- 事前正規化での補完を検討する）。表示には原文（title/name列）を使い、この列は検索専用。
CREATE OR REPLACE FUNCTION ctiip_text_norm(src text) RETURNS text AS $$
  SELECT trim(
    regexp_replace(
      lower(
        translate(
          coalesce(src, ''),
          '０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ',
          '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
        )
      ),
      '\s+', ' ', 'g'
    )
  );
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- 検索対象4テーブルへ text_norm 相当の生成列を追加する（additive・既存列は無変更）。
ALTER TABLE patents ADD COLUMN IF NOT EXISTS title_norm text
  GENERATED ALWAYS AS (ctiip_text_norm(title)) STORED;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS title_norm text
  GENERATED ALWAYS AS (ctiip_text_norm(title)) STORED;
ALTER TABLE netis_technologies ADD COLUMN IF NOT EXISTS name_norm text
  GENERATED ALWAYS AS (ctiip_text_norm(name)) STORED;
ALTER TABLE technologies ADD COLUMN IF NOT EXISTS name_norm text
  GENERATED ALWAYS AS (ctiip_text_norm(name)) STORED;

-- pg_trgm の GIN インデックス（字句検索の類似度検索を高速化）。
CREATE INDEX IF NOT EXISTS idx_patents_title_norm_trgm
  ON patents USING gin (title_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_papers_title_norm_trgm
  ON papers USING gin (title_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_netis_technologies_name_norm_trgm
  ON netis_technologies USING gin (name_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_technologies_name_norm_trgm
  ON technologies USING gin (name_norm gin_trgm_ops);

-- ①構造検索（特許番号・NETIS番号の完全一致/前方一致）を高速化する索引。
-- text_pattern_ops は ILIKE 'xxx%'（前方一致）にも使える演算子クラス。
CREATE INDEX IF NOT EXISTS idx_patents_publication_no_prefix ON patents (publication_no text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_netis_technologies_netis_no_prefix ON netis_technologies (netis_no text_pattern_ops);

-- FR-RBAC-05 C4 個別付与（grant）モデル。docs/10-requirements/05-rbac-matrix.md §4 の
-- C4「個別付与された利用者のみ」を実装する。additive のみ・既存テーブルは無変更。
-- 対象（target_type）は将来の拡張に備え汎用の文字列とする（現状 invention / workflow_instance）。
-- ロールバック: DROP TABLE IF EXISTS access_grants; で元に戻せる（他テーブルからの参照なし）。
CREATE TABLE IF NOT EXISTS access_grants (
  id uuid PRIMARY KEY,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  granted_by uuid NOT NULL REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  note text,
  UNIQUE (target_type, target_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_access_grants_target ON access_grants (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_access_grants_user ON access_grants (user_id);

-- README §16 バックログ「Reporting出力（PDF/DOCX/XLSX）」対応。additive のみ・既存カラムは無変更。
-- reports.status: 'success'（report_files に生成物あり）/ 'failed'（生成失敗。理由は audit_logs.meta）。
-- 既存行（本カラム追加前に作成されたレポート）は DEFAULT により 'success' となるが実ファイルは無い。
-- ダウンロード側（/reports/[id]/download）は report_files 不在を 404 として扱うため実害はない。
-- ロールバック: ALTER TABLE reports DROP COLUMN IF EXISTS status;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success';

-- 自社ホストNode運用（ADR-0007）でオブジェクトストレージが未導入のため、生成済みレポートの
-- ファイル本体は Postgres の bytea 列に保存する（MVPスコープ）。reports 1件につき最大1ファイル
-- （再生成時は同一 report_id の行を UPSERT する想定）。一覧画面では content 列を選択しないこと
-- （重量列のSELECT回避）。
-- ロールバック: DROP TABLE IF EXISTS report_files; で元に戻せる（reports 側の列変更なし）。
CREATE TABLE IF NOT EXISTS report_files (
  id uuid PRIMARY KEY,
  report_id uuid NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
  content bytea NOT NULL,
  mime_type text NOT NULL,
  byte_size integer NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

-- M47 Patent Drawing / Image Intelligence（第二拡張群）。additive のみ・既存テーブルは無変更。
-- 依存: M04（patents）/ M06（claim_elements。任意対応）。
-- ⚠️ Vision AI（画像解析による部品自動認識・図面類似検索）の実呼び出しは本スライスでは未実装。
-- データモデルと画面（デモデータの一覧・詳細表示）のみを先行実装する（ユーザー承認済み）。
-- image_url は実画像を保存せず、他エンティティ（patents.source_url 等）と同様の外部参照URLの
-- プレースホルダとする。
-- ロールバック: 下記3テーブルを DROP TABLE IF EXISTS drawing_similarities, drawing_parts,
-- patent_drawings CASCADE; の順で削除すれば元に戻せる（他テーブルからの参照なし）。
CREATE TABLE IF NOT EXISTS patent_drawings (
  id uuid PRIMARY KEY,
  patent_id uuid NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
  figure_no text NOT NULL,
  image_url text,
  caption text,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patent_drawings_patent ON patent_drawings (patent_id);

CREATE TABLE IF NOT EXISTS drawing_parts (
  id uuid PRIMARY KEY,
  drawing_id uuid NOT NULL REFERENCES patent_drawings(id) ON DELETE CASCADE,
  part_no text NOT NULL,
  description text NOT NULL,
  element_id uuid REFERENCES claim_elements(id),
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drawing_parts_drawing ON drawing_parts (drawing_id);

CREATE TABLE IF NOT EXISTS drawing_similarities (
  id uuid PRIMARY KEY,
  drawing_id uuid NOT NULL REFERENCES patent_drawings(id) ON DELETE CASCADE,
  similar_drawing_id uuid NOT NULL REFERENCES patent_drawings(id) ON DELETE CASCADE,
  similarity_score numeric(5,2) NOT NULL,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drawing_similarities_drawing ON drawing_similarities (drawing_id);
CREATE INDEX IF NOT EXISTS idx_drawing_similarities_similar ON drawing_similarities (similar_drawing_id);

-- Vision AI実接続（ユーザー承認済み。M47/M48 Vision AI統合）対応。additive のみ。
-- 実画像本体（bytea）を patent_drawings に保持する。既存の image_url 列はプレースホルダ用途の
-- ままとし変更しない。既存のデモ行は image_data/mime_type とも NULL のまま（後方互換）。
-- ロールバック: ALTER TABLE patent_drawings DROP COLUMN IF EXISTS image_data; DROP COLUMN IF EXISTS mime_type;
ALTER TABLE patent_drawings ADD COLUMN IF NOT EXISTS image_data bytea;
ALTER TABLE patent_drawings ADD COLUMN IF NOT EXISTS mime_type text;

-- M48 Engineering Document Intelligence（第二拡張群）。additive のみ・既存テーブルは無変更。
-- 依存: M02（sites。任意参照）/ M03（users。任意参照）/ M04（patents）/ M09（technologiesは使わず独立管理）。
-- ⚠️ Vision AI・文書解析AI（PDF/CAD/BIM/写真/スケッチからの技術要素抽出・特許マッチング）の実呼び出しは
-- 本スライスでは未実装。データモデルと画面（デモデータの一覧・詳細表示）のみを先行実装する（ユーザー承認済み）。
-- source_url は実ファイルを保存せず、他エンティティ（patents.source_url 等）と同様の外部参照URLの
-- プレースホルダとする。
-- ロールバック: 下記3テーブルを DROP TABLE IF EXISTS document_element_patent_matches,
-- extracted_tech_elements, engineering_documents CASCADE; の順で削除すれば元に戻せる（他テーブルからの参照なし）。
CREATE TABLE IF NOT EXISTS engineering_documents (
  id uuid PRIMARY KEY,
  doc_type text NOT NULL CHECK (doc_type IN ('pdf','cad','bim','photo','sketch')),
  title text NOT NULL,
  site_id uuid REFERENCES sites(id),
  source_url text,
  uploaded_by uuid REFERENCES users(id),
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_engineering_documents_site ON engineering_documents (site_id);
CREATE INDEX IF NOT EXISTS idx_engineering_documents_doc_type ON engineering_documents (doc_type);

CREATE TABLE IF NOT EXISTS extracted_tech_elements (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES engineering_documents(id) ON DELETE CASCADE,
  element_label text NOT NULL,
  description text,
  confidence numeric(4,2),
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_extracted_tech_elements_document ON extracted_tech_elements (document_id);

CREATE TABLE IF NOT EXISTS document_element_patent_matches (
  id uuid PRIMARY KEY,
  element_id uuid NOT NULL REFERENCES extracted_tech_elements(id) ON DELETE CASCADE,
  patent_id uuid NOT NULL REFERENCES patents(id),
  match_score numeric(5,2) NOT NULL,
  is_sample boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_document_element_patent_matches_element ON document_element_patent_matches (element_id);
CREATE INDEX IF NOT EXISTS idx_document_element_patent_matches_patent ON document_element_patent_matches (patent_id);
