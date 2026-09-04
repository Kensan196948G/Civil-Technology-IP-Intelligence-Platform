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
