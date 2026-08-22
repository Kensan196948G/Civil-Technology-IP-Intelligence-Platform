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

CREATE INDEX IF NOT EXISTS idx_patents_title ON patents (title);
CREATE INDEX IF NOT EXISTS idx_technologies_name ON technologies (name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred ON audit_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_status ON workflow_instances (status);
