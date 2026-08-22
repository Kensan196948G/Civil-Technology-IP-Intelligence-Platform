# 🗄️ データベース設計

| 項目 | 値 |
|---|---|
| DBMS | Neon PostgreSQL 16+ |
| 拡張 | `pgvector`, `pg_trgm`, `uuid-ossp`（または `pgcrypto`）, `unaccent` |
| ORM | Drizzle ORM |
| 命名 | テーブル・列ともに `snake_case`、複数形。主キーは `id` |
| 主キー | UUID v7 相当（時系列順の UUID）。アプリ側で生成 |
| 時刻 | すべて `timestamptz`。保存は UTC |

---

## 1. 論理構成

```text
① 基盤        users / roles / departments / projects / audit_logs
② 外部データ  patents / patent_claims / papers / netis_technologies
③ 社内資産    technologies / sites / inventions / ip_assets
④ 分析        prior_art_studies / claim_analyses / examiner_reviews / field_applications
⑤ AI          ai_runs / ai_citations / agent_runs / agent_steps
⑥ 検索        document_chunks / search_queries
⑦ 業務        workflow_* / approvals / reports / watches
⑧ 品質        entity_aliases / dq_issues / ingest_runs
```

汎用の関連付けは `entity_links` に集約し、モジュールごとに中間テーブルを乱立させない。

---

## 2. 共通列

すべての業務テーブルに次を持たせる。

| 列 | 型 | 説明 |
|---|---|---|
| `id` | `uuid` | 主キー |
| `created_at` | `timestamptz` | 作成日時 |
| `updated_at` | `timestamptz` | 更新日時 |
| `created_by` | `uuid` | 作成者（`users.id`） |
| `updated_by` | `uuid` | 更新者 |
| `deleted_at` | `timestamptz` NULL | 論理削除。NULL 以外は既定で不可視 |

外部由来のデータには追加で次を持たせる（**MUST**）。

| 列 | 型 | 説明 |
|---|---|---|
| `source` | `text` | 取得元の識別子 |
| `source_id` | `text` | 取得元での一意ID |
| `source_url` | `text` | 原文URL |
| `retrieved_at` | `timestamptz` | 取得日時 |
| `license_note` | `text` | 再配布条件のメモ |

機密性を持つテーブルには次を持たせる（**MUST**）。

| 列 | 型 | 説明 |
|---|---|---|
| `classification` | `text` | `C1` / `C2` / `C3` / `C4` |
| `project_id` | `uuid` NULL | 行レベル権限の単位 |

---

## 3. DDL（中核テーブル）

### 3.1 拡張と共通型

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TYPE classification_t AS ENUM ('C1','C2','C3','C4');
CREATE TYPE run_status_t     AS ENUM ('queued','running','succeeded','failed','cancelled','invalid');
CREATE TYPE source_type_t    AS ENUM ('patent','paper','netis','technology','document','invention','study','report');
CREATE TYPE match_kind_t     AS ENUM ('match','similar','differ','absent');
```

### 3.2 基盤

```sql
CREATE TABLE users (
  id            uuid PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  department_id uuid REFERENCES departments(id),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE departments (
  id     uuid PRIMARY KEY,
  code   text NOT NULL UNIQUE,          -- '01'..'08'
  name   text NOT NULL,                 -- '経営・統治・委員会' 等
  parent_id uuid REFERENCES departments(id)
);

CREATE TABLE roles (
  code   text PRIMARY KEY,              -- engineer / tech_manager / rnd / ip / legal / executive / sysadmin / viewer
  name   text NOT NULL
);

CREATE TABLE user_roles (
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_code text NOT NULL REFERENCES roles(code),
  granted_by uuid REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_code)
);

CREATE TABLE projects (
  id             uuid PRIMARY KEY,
  code           text NOT NULL UNIQUE,
  name           text NOT NULL,
  classification classification_t NOT NULL DEFAULT 'C2',
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_in_project text NOT NULL DEFAULT 'member',
  PRIMARY KEY (project_id, user_id)
);

-- C4 の個別付与
CREATE TABLE resource_grants (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type source_type_t NOT NULL,
  source_id   uuid NOT NULL,
  can_export  boolean NOT NULL DEFAULT false,
  granted_by  uuid NOT NULL REFERENCES users(id),
  granted_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz
);
CREATE INDEX ON resource_grants (user_id, source_type, source_id);
```

### 3.3 監査ログ（追記専用）

```sql
CREATE TABLE audit_logs (
  id             uuid PRIMARY KEY,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  actor_user_id  uuid REFERENCES users(id),
  actor_roles    text[] NOT NULL DEFAULT '{}',
  action         text NOT NULL,        -- login / search / view / ai_run / export / download / update / delete / approve / grant
  target_type    text,
  target_id      uuid,
  classification classification_t,
  result         text NOT NULL,        -- success / failure / denied
  reason         text,                 -- denied の理由
  ip             inet,
  user_agent     text,
  correlation_id text NOT NULL,
  meta           jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX ON audit_logs (occurred_at DESC);
CREATE INDEX ON audit_logs (actor_user_id, occurred_at DESC);
CREATE INDEX ON audit_logs (action, occurred_at DESC);
CREATE INDEX ON audit_logs (target_type, target_id);

-- 追記専用の強制（アプリ用ロールから UPDATE/DELETE を剥奪する）
REVOKE UPDATE, DELETE ON audit_logs FROM ctiip_app;
```

### 3.4 特許

```sql
CREATE TABLE patents (
  id                uuid PRIMARY KEY,
  country           char(2) NOT NULL,
  publication_no    text,
  registration_no   text,
  application_no    text,
  title             text NOT NULL,
  title_norm        text,               -- 正規化タイトル（trgm 用）
  abstract          text,
  application_date  date,
  publication_date  date,
  priority_date     date,
  registration_date date,
  legal_status      text,               -- 出願中/登録/拒絶/放棄/失効
  family_id         uuid REFERENCES patent_families(id),
  classification    classification_t NOT NULL DEFAULT 'C1',
  source            text NOT NULL,
  source_id         text NOT NULL,
  source_url        text,
  retrieved_at      timestamptz NOT NULL,
  license_note      text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  UNIQUE (source, source_id)
);
CREATE INDEX ON patents USING gin (title_norm gin_trgm_ops);
CREATE INDEX ON patents (country, publication_no);
CREATE INDEX ON patents (application_date);
CREATE INDEX ON patents (family_id);

CREATE TABLE patent_families (
  id        uuid PRIMARY KEY,
  family_key text NOT NULL UNIQUE,     -- 取得元のファミリー識別子
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE patent_claims (
  id           uuid PRIMARY KEY,
  patent_id    uuid NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
  claim_no     int  NOT NULL,
  is_independent boolean NOT NULL,
  depends_on   int[],                   -- 従属先の請求項番号
  text         text NOT NULL,
  text_norm    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patent_id, claim_no)
);
CREATE INDEX ON patent_claims USING gin (text_norm gin_trgm_ops);

-- 構成要件（AIが分解し、人が修正しうる）
CREATE TABLE claim_elements (
  id           uuid PRIMARY KEY,
  claim_id     uuid NOT NULL REFERENCES patent_claims(id) ON DELETE CASCADE,
  seq          int  NOT NULL,
  label        text NOT NULL,           -- 'A','B','C' 等
  text         text NOT NULL,
  char_start   int,                     -- 原文中の位置（Provenance 用）
  char_end     int,
  is_essential boolean NOT NULL DEFAULT true,
  edited_by    uuid REFERENCES users(id),
  ai_run_id    uuid REFERENCES ai_runs(id),
  UNIQUE (claim_id, seq)
);

CREATE TABLE applicants (
  id            uuid PRIMARY KEY,
  canonical_name text NOT NULL,
  country       char(2),
  is_competitor boolean NOT NULL DEFAULT false,
  UNIQUE (canonical_name)
);

CREATE TABLE inventors (
  id            uuid PRIMARY KEY,
  canonical_name text NOT NULL
);

CREATE TABLE patent_applicants (
  patent_id    uuid NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES applicants(id),
  seq          int NOT NULL,
  PRIMARY KEY (patent_id, applicant_id)
);

CREATE TABLE patent_inventors (
  patent_id   uuid NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
  inventor_id uuid NOT NULL REFERENCES inventors(id),
  seq         int NOT NULL,
  PRIMARY KEY (patent_id, inventor_id)
);

CREATE TABLE patent_classifications (
  patent_id uuid NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
  scheme    text NOT NULL,              -- 'IPC' | 'CPC'
  code      text NOT NULL,              -- 正規化済み
  is_main   boolean NOT NULL DEFAULT false,
  PRIMARY KEY (patent_id, scheme, code)
);
CREATE INDEX ON patent_classifications (scheme, code);

CREATE TABLE patent_citations (
  citing_id uuid NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
  cited_id  uuid NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
  kind      text,                       -- applicant / examiner
  PRIMARY KEY (citing_id, cited_id)
);
```

### 3.5 論文・NETIS

```sql
CREATE TABLE papers (
  id           uuid PRIMARY KEY,
  title        text NOT NULL,
  title_norm   text,
  abstract     text,
  published_on date,
  venue        text,
  doi          text,
  classification classification_t NOT NULL DEFAULT 'C1',
  source text NOT NULL, source_id text NOT NULL, source_url text,
  retrieved_at timestamptz NOT NULL, license_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);
CREATE INDEX ON papers USING gin (title_norm gin_trgm_ops);

CREATE TABLE netis_technologies (
  id            uuid PRIMARY KEY,
  netis_no      text NOT NULL UNIQUE,
  name          text NOT NULL,
  name_norm     text,
  summary       text,
  category      text,
  evaluation    jsonb,                  -- 評価情報
  applicable_conditions jsonb,
  registered_on date,
  source text NOT NULL, source_id text NOT NULL, source_url text,
  retrieved_at timestamptz NOT NULL, license_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON netis_technologies USING gin (name_norm gin_trgm_ops);
```

### 3.6 社内技術台帳

```sql
CREATE TABLE technologies (
  id             uuid PRIMARY KEY,
  kind           text NOT NULL,          -- technology / method / material / machine
  name           text NOT NULL,
  name_norm      text,
  summary        text,
  principle      text,                   -- 技術原理
  problem_solved text,
  applicable_conditions jsonb,           -- {ground:[], marine:{}, ...} 規則判定に使う
  constraints    jsonb,
  merits         text[],
  demerits       text[],
  required_equipment text[],
  required_staff jsonb,
  required_licenses text[],
  maturity       text,                   -- 技術成熟度
  classification classification_t NOT NULL DEFAULT 'C2',
  project_id     uuid REFERENCES projects(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  deleted_at timestamptz
);
CREATE INDEX ON technologies USING gin (name_norm gin_trgm_ops);
CREATE INDEX ON technologies (kind);

-- 台帳の版管理
CREATE TABLE technology_versions (
  id            uuid PRIMARY KEY,
  technology_id uuid NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  version       int NOT NULL,
  snapshot      jsonb NOT NULL,
  changed_by    uuid REFERENCES users(id),
  changed_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (technology_id, version)
);

-- 機械台帳（保有船舶・建機）
CREATE TABLE machines (
  id            uuid PRIMARY KEY,
  technology_id uuid REFERENCES technologies(id),
  machine_type  text NOT NULL,           -- 起重機船 / 浚渫船 / 作業船 / 建設機械
  name          text NOT NULL,
  specs         jsonb NOT NULL DEFAULT '{}',
  owner_dept_id uuid REFERENCES departments(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.7 分類（土木観点）

```sql
CREATE TABLE civil_categories (
  code      text PRIMARY KEY,           -- 'port','marine','river','road','bridge','tunnel',...
  name      text NOT NULL,
  kind      text NOT NULL,              -- work_type | construction_tech
  parent_code text REFERENCES civil_categories(code)
);

CREATE TABLE civil_classifications (
  id          uuid PRIMARY KEY,
  source_type source_type_t NOT NULL,
  source_id   uuid NOT NULL,
  category_code text NOT NULL REFERENCES civil_categories(code),
  confidence  numeric(4,3) NOT NULL,     -- 0.000-1.000
  assigned_by text NOT NULL,             -- 'ai' | 'human'
  ai_run_id   uuid REFERENCES ai_runs(id),
  corrected_from uuid REFERENCES civil_classifications(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, category_code)
);
CREATE INDEX ON civil_classifications (category_code);
CREATE INDEX ON civil_classifications (source_type, source_id);
```

### 3.8 汎用関連付け

```sql
CREATE TABLE entity_links (
  id        uuid PRIMARY KEY,
  from_type source_type_t NOT NULL,
  from_id   uuid NOT NULL,
  to_type   source_type_t NOT NULL,
  to_id     uuid NOT NULL,
  relation  text NOT NULL,              -- related / similar / prior_art / implements / supersedes
  score     numeric(5,4),
  created_by_ai boolean NOT NULL DEFAULT false,
  ai_run_id uuid REFERENCES ai_runs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_type, from_id, to_type, to_id, relation)
);
CREATE INDEX ON entity_links (from_type, from_id);
CREATE INDEX ON entity_links (to_type, to_id);
```

### 3.9 AI と Provenance（中核）

```sql
CREATE TABLE ai_runs (
  id             uuid PRIMARY KEY,
  kind           text NOT NULL,          -- summarize / classify / claim_decompose / examine / score / answer / report
  status         run_status_t NOT NULL DEFAULT 'queued',
  requested_by   uuid NOT NULL REFERENCES users(id),
  target_type    source_type_t,
  target_id      uuid,
  project_id     uuid REFERENCES projects(id),
  classification classification_t NOT NULL,
  model          text NOT NULL,          -- 使用モデルID（必須。再現性の判断に使う）
  prompt_version text NOT NULL,
  params         jsonb NOT NULL DEFAULT '{}',
  input_hash     text,
  output         jsonb,
  token_input    int,
  token_output   int,
  duration_ms    int,
  error          text,
  correlation_id text NOT NULL,
  started_at     timestamptz,
  finished_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON ai_runs (status, created_at DESC);
CREATE INDEX ON ai_runs (target_type, target_id);
CREATE INDEX ON ai_runs (requested_by, created_at DESC);

-- 根拠。ai_runs 1件に対し 1件以上必須
CREATE TABLE ai_citations (
  id          uuid PRIMARY KEY,
  ai_run_id   uuid NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
  claim_key   text,                      -- 出力中のどの主張に対応するか
  source_type source_type_t NOT NULL,
  source_id   uuid NOT NULL,
  locator     jsonb NOT NULL,            -- { claim_no, paragraph, char_start, char_end }
  quoted_text text NOT NULL,             -- 原文からの機械的な切り出し（AI生成禁止）
  source_url  text,
  retrieved_at timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON ai_citations (ai_run_id);
CREATE INDEX ON ai_citations (source_type, source_id);

-- AI送信ポリシーの判定記録
CREATE TABLE ai_policy_checks (
  id         uuid PRIMARY KEY,
  ai_run_id  uuid NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
  classification classification_t NOT NULL,
  decision   text NOT NULL,              -- allow / deny / allow_with_grant
  policy_version text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);
```

**整合性の検証クエリ**（受入条件 A-03）

```sql
-- 根拠を欠く成功済み AI 実行は 0 件でなければならない
SELECT count(*) FROM ai_runs r
WHERE r.status = 'succeeded'
  AND NOT EXISTS (SELECT 1 FROM ai_citations c WHERE c.ai_run_id = r.id);
```

### 3.10 検索（チャンクと埋め込み）

```sql
CREATE TABLE document_chunks (
  id             uuid PRIMARY KEY,
  source_type    source_type_t NOT NULL,
  source_id      uuid NOT NULL,
  chunk_seq      int NOT NULL,
  section        text,                   -- '請求項1' / '実施例' / '要約' 等
  text           text NOT NULL,
  text_norm      text NOT NULL,          -- 正規化本文（trgm 用）
  char_start     int,
  char_end       int,
  keywords       text[],                 -- AI抽出の正規化キーワード
  embedding      vector(1024),           -- ⚠️ 次元数はモデル確定後に固定
  embed_model    text NOT NULL,
  classification classification_t NOT NULL,
  project_id     uuid REFERENCES projects(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, chunk_seq)
);

CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON document_chunks USING gin (text_norm gin_trgm_ops);
CREATE INDEX ON document_chunks USING gin (keywords);
CREATE INDEX ON document_chunks (source_type, source_id);
CREATE INDEX ON document_chunks (classification, project_id);

CREATE TABLE search_queries (
  id           uuid PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id),
  raw_input    text NOT NULL,
  query_dsl    jsonb NOT NULL,           -- 実行した検索式（再現用）
  filters      jsonb NOT NULL DEFAULT '{}',
  hit_count    int NOT NULL,
  duration_ms  int,
  study_id     uuid,                     -- 調査案件に紐づく場合
  executed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON search_queries (user_id, executed_at DESC);
CREATE INDEX ON search_queries (study_id);
```

### 3.11 先行技術調査・Claim・模擬審査

```sql
CREATE TABLE prior_art_studies (
  id            uuid PRIMARY KEY,
  title         text NOT NULL,
  purpose       text,
  target_type   source_type_t,
  target_id     uuid,
  scope         jsonb NOT NULL,          -- 調査範囲（DB・期間・国・分類）
  status        text NOT NULL DEFAULT 'draft',
  classification classification_t NOT NULL DEFAULT 'C3',
  project_id    uuid REFERENCES projects(id),
  conducted_by  uuid REFERENCES users(id),
  conducted_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE prior_art_hits (
  id          uuid PRIMARY KEY,
  study_id    uuid NOT NULL REFERENCES prior_art_studies(id) ON DELETE CASCADE,
  source_type source_type_t NOT NULL,
  source_id   uuid NOT NULL,
  importance  int,                        -- 1..5（人が付与）
  ai_score    numeric(5,4),
  comment     text,
  is_key      boolean NOT NULL DEFAULT false,
  added_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (study_id, source_type, source_id)
);

CREATE TABLE claim_analyses (
  id           uuid PRIMARY KEY,
  left_type    source_type_t NOT NULL,   -- 比較元（他社特許 等）
  left_id      uuid NOT NULL,
  right_type   source_type_t NOT NULL,   -- 比較先（自社案 等）
  right_id     uuid NOT NULL,
  similarity   numeric(5,4),             -- 一致要件数 / 全要件数
  ai_run_id    uuid REFERENCES ai_runs(id),
  classification classification_t NOT NULL DEFAULT 'C3',
  project_id   uuid REFERENCES projects(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE claim_chart_rows (
  id            uuid PRIMARY KEY,
  analysis_id   uuid NOT NULL REFERENCES claim_analyses(id) ON DELETE CASCADE,
  left_element_id  uuid REFERENCES claim_elements(id),
  right_element_ref jsonb,                -- 自社案は claim_elements を持たない場合がある
  kind          match_kind_t NOT NULL,    -- match / similar / differ / absent
  rationale     text,
  citation_ids  uuid[] NOT NULL DEFAULT '{}',
  edited_by     uuid REFERENCES users(id),
  seq           int NOT NULL
);
```

> ⚠️ `claim_analyses` に侵害判定に相当する列を**追加しないこと**。設計上の絶対条件（ADR-0006 / FR-M06-020）。

```sql
CREATE TABLE examiner_reviews (
  id            uuid PRIMARY KEY,
  invention_id  uuid REFERENCES inventions(id),
  patent_id     uuid REFERENCES patents(id),
  status        run_status_t NOT NULL DEFAULT 'queued',
  novelty_risk      text,                 -- low / medium / high
  inventive_risk    text,
  description_risk  text,
  overlap_risk      text,
  ai_run_id     uuid REFERENCES ai_runs(id),
  human_check_completed_at timestamptz,   -- 完了までワークフローを進めない
  human_checked_by uuid REFERENCES users(id),
  classification classification_t NOT NULL DEFAULT 'C3',
  project_id    uuid REFERENCES projects(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE examiner_findings (
  id         uuid PRIMARY KEY,
  review_id  uuid NOT NULL REFERENCES examiner_reviews(id) ON DELETE CASCADE,
  category   text NOT NULL,               -- novelty / inventive / description / overlap / human_check
  severity   text NOT NULL,               -- low / medium / high
  summary    text NOT NULL,
  detail     text,
  citation_ids uuid[] NOT NULL DEFAULT '{}',
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id)
);
```

### 3.12 現場適用性

```sql
CREATE TABLE sites (
  id          uuid PRIMARY KEY,
  code        text UNIQUE,
  name        text NOT NULL,
  work_types  text[] NOT NULL DEFAULT '{}',
  department_id uuid REFERENCES departments(id),
  project_id  uuid REFERENCES projects(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE site_conditions (
  id        uuid PRIMARY KEY,
  site_id   uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  conditions jsonb NOT NULL,             -- {ground, terrain, river, marine, weather, yard, surroundings}
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES users(id)
);

CREATE TABLE site_issues (
  id        uuid PRIMARY KEY,
  site_id   uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  body      text NOT NULL,                -- 自然文
  category  text,
  photos    text[] NOT NULL DEFAULT '{}', -- R2 のキー
  status    text NOT NULL DEFAULT 'open',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE field_applications (
  id           uuid PRIMARY KEY,
  site_issue_id uuid NOT NULL REFERENCES site_issues(id) ON DELETE CASCADE,
  candidate_type source_type_t NOT NULL, -- technology / patent / netis
  candidate_id uuid NOT NULL,
  score        numeric(5,2) NOT NULL,     -- 0.00-100.00
  axes         jsonb NOT NULL,            -- [{axis, value, weight, basis, is_estimated}]
  blockers     jsonb NOT NULL DEFAULT '[]',
  ai_run_id    uuid REFERENCES ai_runs(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON field_applications (site_issue_id, score DESC);
```

> **MUST**: `axes` を必ず保存する。スコアのみの保存を禁止する（FR-M13-005/006）。

### 3.13 発明・知財・ライセンス・法務

```sql
CREATE TABLE inventions (
  id            uuid PRIMARY KEY,
  title         text NOT NULL,
  summary       text,
  problem       text,
  composition   text,
  effect        text,
  site_id       uuid REFERENCES sites(id),
  project_id    uuid REFERENCES projects(id),
  classification classification_t NOT NULL DEFAULT 'C3',  -- 既定で機密
  status        text NOT NULL DEFAULT 'draft',
  submitted_by  uuid NOT NULL REFERENCES users(id),
  submitted_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invention_inventors (
  invention_id uuid NOT NULL REFERENCES inventions(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id),
  share        numeric(5,2),
  PRIMARY KEY (invention_id, user_id)
);

CREATE TABLE ip_assets (
  id            uuid PRIMARY KEY,
  invention_id  uuid REFERENCES inventions(id),
  patent_id     uuid REFERENCES patents(id),
  status        text NOT NULL,            -- filed / pending / granted / rejected / abandoned / expired
  importance    int,                      -- 1..5
  maintain_priority int,
  is_utilized   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ip_events (
  id         uuid PRIMARY KEY,
  ip_asset_id uuid NOT NULL REFERENCES ip_assets(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  occurred_on date NOT NULL,
  note       text,
  source     text                          -- 'legalops' 等（I-04 同期）
);

CREATE TABLE ip_costs (
  id         uuid PRIMARY KEY,
  ip_asset_id uuid NOT NULL REFERENCES ip_assets(id) ON DELETE CASCADE,
  cost_type  text NOT NULL,               -- filing / annuity / attorney / license
  amount     numeric(14,2),
  currency   char(3) NOT NULL DEFAULT 'JPY',
  incurred_on date
);

CREATE TABLE license_candidates (
  id           uuid PRIMARY KEY,
  need_id      uuid REFERENCES tech_needs(id),
  patent_id    uuid REFERENCES patents(id),
  technology_id uuid REFERENCES technologies(id),
  direction    text NOT NULL,             -- in（導入）/ out（供与）
  fit_score    numeric(5,2),
  evaluation   jsonb,                     -- Buy/Build/Partner 比較
  status       text NOT NULL DEFAULT 'draft',
  classification classification_t NOT NULL DEFAULT 'C3',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE legal_requests (
  id           uuid PRIMARY KEY,
  subject_type source_type_t NOT NULL,
  subject_id   uuid NOT NULL,
  checklist    jsonb NOT NULL,            -- 法務確認事項（準備資料。判断ではない）
  questions    text[],
  status       text NOT NULL DEFAULT 'draft', -- draft/sent/answered/closed
  external_ref text,                      -- LegalOps 側の案件ID
  sent_at      timestamptz,
  answered_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

### 3.14 R&D・ウォッチ・レポート

```sql
CREATE TABLE tech_needs (
  id         uuid PRIMARY KEY,
  title      text NOT NULL,
  body       text,
  origin_type source_type_t,              -- site_issue / landscape 等
  origin_id  uuid,
  department_id uuid REFERENCES departments(id),
  status     text NOT NULL DEFAULT 'open',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rnd_themes (
  id          uuid PRIMARY KEY,
  title       text NOT NULL,
  description text,
  origin      text,                       -- whitespace / need / idea
  market_score numeric(4,2),
  feasibility_score numeric(4,2),
  ip_risk_score numeric(4,2),
  priority    int,
  build_buy_partner text,
  status      text NOT NULL DEFAULT 'proposed',
  classification classification_t NOT NULL DEFAULT 'C3',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE watches (
  id         uuid PRIMARY KEY,
  kind       text NOT NULL,               -- technology / company / patent
  name       text NOT NULL,
  criteria   jsonb NOT NULL,
  owner_id   uuid NOT NULL REFERENCES users(id),
  frequency  text NOT NULL DEFAULT 'weekly',
  is_active  boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE watch_hits (
  id         uuid PRIMARY KEY,
  watch_id   uuid NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  source_type source_type_t NOT NULL,
  source_id  uuid NOT NULL,
  change_kind text NOT NULL,              -- new / published / granted / rejected / abandoned / owner_changed
  summary    text,                        -- AI要約
  ai_run_id  uuid REFERENCES ai_runs(id),
  detected_at timestamptz NOT NULL DEFAULT now(),
  read_at    timestamptz,
  handled_at timestamptz,
  UNIQUE (watch_id, source_type, source_id, change_kind)
);

CREATE TABLE reports (
  id          uuid PRIMARY KEY,
  kind        text NOT NULL,
  title       text NOT NULL,
  params      jsonb NOT NULL DEFAULT '{}',
  status      run_status_t NOT NULL DEFAULT 'queued',
  format      text NOT NULL,              -- html/pdf/docx/xlsx/csv/json
  r2_key      text,
  classification classification_t NOT NULL,
  watermark   boolean NOT NULL DEFAULT true,
  requested_by uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### 3.15 ワークフロー

```sql
CREATE TABLE workflow_definitions (
  id        uuid PRIMARY KEY,
  code      text NOT NULL UNIQUE,         -- invention / field_adoption / license_in
  version   int NOT NULL,
  steps     jsonb NOT NULL,               -- [{key,type:'ai'|'human',role,next,...}]
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workflow_instances (
  id          uuid PRIMARY KEY,
  definition_id uuid NOT NULL REFERENCES workflow_definitions(id),
  subject_type source_type_t NOT NULL,
  subject_id  uuid NOT NULL,
  status      text NOT NULL,              -- Draft/Researching/AIReviewed/TechnicalReview/IPReview/LegalReview/Approved/Rejected/Hold/Archived
  current_step text,
  assignee_id uuid REFERENCES users(id),
  due_on      date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON workflow_instances (status, assignee_id);
CREATE INDEX ON workflow_instances (subject_type, subject_id);

CREATE TABLE workflow_steps (
  id          uuid PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  step_key    text NOT NULL,
  type        text NOT NULL,              -- ai / human
  ai_run_id   uuid REFERENCES ai_runs(id),
  entered_at  timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  result      text
);

CREATE TABLE approvals (
  id          uuid PRIMARY KEY,
  step_id     uuid NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES users(id),
  decision    text NOT NULL,              -- approved / rejected / hold / returned
  comment     text,
  subject_version int,
  decided_at  timestamptz NOT NULL DEFAULT now()
);
```

### 3.16 データ品質・取り込み

```sql
CREATE TABLE ingest_sources (
  code       text PRIMARY KEY,
  name       text NOT NULL,
  base_url   text,
  license_note text,
  is_active  boolean NOT NULL DEFAULT true
);

CREATE TABLE ingest_runs (
  id         uuid PRIMARY KEY,
  source_code text NOT NULL REFERENCES ingest_sources(code),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status     run_status_t NOT NULL DEFAULT 'running',
  fetched    int NOT NULL DEFAULT 0,
  inserted   int NOT NULL DEFAULT 0,
  updated    int NOT NULL DEFAULT 0,
  failed     int NOT NULL DEFAULT 0,
  cursor     jsonb,                       -- 差分取得の位置
  error      text
);

CREATE TABLE entity_aliases (
  id            uuid PRIMARY KEY,
  entity_type   text NOT NULL,            -- applicant / inventor / institution
  canonical_id  uuid,                     -- 確定後に設定
  raw_name      text NOT NULL,
  normalized    text NOT NULL,
  confidence    numeric(4,3),
  confirmed_by  uuid REFERENCES users(id),
  confirmed_at  timestamptz,
  UNIQUE (entity_type, raw_name)
);
CREATE INDEX ON entity_aliases USING gin (normalized gin_trgm_ops);

CREATE TABLE dq_issues (
  id         uuid PRIMARY KEY,
  kind       text NOT NULL,               -- missing / duplicate / anomaly / ocr / unclassified
  source_type source_type_t,
  source_id  uuid,
  detail     jsonb NOT NULL,
  severity   text NOT NULL DEFAULT 'medium',
  status     text NOT NULL DEFAULT 'open',
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id)
);
```

---

## 4. インデックス方針

| 目的 | 方式 |
|---|---|
| ベクトル検索 | `hnsw (embedding vector_cosine_ops)`。⚠️ パラメータは実測で調整 |
| 日本語字句検索 | `gin (text_norm gin_trgm_ops)`。正規化済み列に対して張る |
| キーワード | `gin (keywords)` |
| 権限フィルタ | `(classification, project_id)` の複合 |
| 時系列 | `created_at DESC` / `occurred_at DESC` |
| 外部キー | 参照側に必ず索引を張る |

⚠️ トライグラム索引はサイズが大きい。Phase 1 で実サイズを計測し、対象列を絞る判断を行う（ADR-0003 の再評価に連動）。

---

## 5. 行レベルセキュリティ

Postgres の RLS ではなく、**アプリ層で SQL に権限条件を必ず含める**方式とする。

**理由**: Neon への接続はアプリ用の単一ロールで行い、利用者ごとの DB ロールを作らないため。
ただし、権限条件の付与漏れを防ぐため次を義務づける。

| # | ルール |
|---|---|
| 1 | 機密性のあるテーブルへのクエリは `packages/db` のヘルパ経由に限定する |
| 2 | ヘルパは `AccessContext` を必須引数とし、WHERE 句を自動付与する |
| 3 | 生SQLの直接実行は lint で検出し、レビューで承認された箇所のみ許可する |
| 4 | 権限条件の付与漏れを検出するテストを CI に置く |

```sql
-- ヘルパが自動付与する条件の例
WHERE deleted_at IS NULL
  AND (
       classification IN ('C1','C2')
    OR (classification = 'C3' AND project_id = ANY($ctx_project_ids))
    OR (classification = 'C4' AND id = ANY($ctx_granted_ids))
  )
```

---

## 6. マイグレーション方針

| 項目 | 方針 |
|---|---|
| ツール | Drizzle Kit（SQL ファイルを生成し、レビュー対象とする） |
| 原則 | **加算のみ・後方互換のみ**。列の削除・型変更は段階的に行う |
| 破壊的変更 | 別PRに分離し、承認を得る。データ削除を伴う変更は 🔒 承認必要 |
| 手順 | ①列追加 → ②両対応でデプロイ → ③データ移行 → ④旧列の参照停止 → ⑤別リリースで削除 |
| 検証 | PR ごとに Neon ブランチへ適用し、ロールバックも検証する |
| 記録 | 各マイグレーションに目的・影響・ロールバック手順をコメントで記載する |

---

## 7. 容量見積

⚠️ **要決定** — 実データ量の確定後に算出する。以下は算出式のみ示す。

| 対象 | 算出式 |
|---|---|
| 特許本体 | 件数 × 平均レコード長 |
| 請求項 | 件数 × 平均請求項数 × 平均文字数 |
| チャンク | 件数 × 平均チャンク数 |
| 埋め込み | チャンク数 × 次元数 × 4 bytes |
| trgm 索引 | 対象列の総文字数に比例（実測必須） |
| 監査ログ | 1日あたり操作件数 × 保持日数 |

**Phase 1 の必須作業**: 代表1万件を取り込み、上記を実測して本節を確定させる。
