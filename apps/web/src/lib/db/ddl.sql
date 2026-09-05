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
  created_at timestamptz NOT NULL DEFAULT now()
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
