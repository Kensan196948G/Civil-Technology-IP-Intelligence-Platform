# 📐 次期拡張モジュール計画（M26〜M50）

> 本文書は、CTIIP に追加する機能モジュール候補 **M26〜M50** の**正本（authoritative candidate list）**です。
> 採用可否・時期・範囲の最終判断はまだ行われていません（⚠️ **要決定**）。決裁後に本計画の内容を
> [01-project-charter.md](../00-overview/01-project-charter.md)（スコープ）と
> [01-roadmap.md](01-roadmap.md)（フェーズ）へ正式に反映します。

| 項目 | 値 |
|---|---|
| 🏷️ 文書種別 | プロジェクト計画（拡張候補の正本） |
| 📋 対象 | M26〜M50（25モジュールの追加候補） |
| 📅 作成 | 2026-08（レビュー分析）→ 2026-09-04 正文化 |
| 📎 関連Issue | [#10](https://github.com/Kensan196948G/Civil-Technology-IP-Intelligence-Platform/issues/10)・[#11](https://github.com/Kensan196948G/Civil-Technology-IP-Intelligence-Platform/issues/11)・[#13](https://github.com/Kensan196948G/Civil-Technology-IP-Intelligence-Platform/issues/13) |
| 🧭 上位文書 | [01-project-charter.md](../00-overview/01-project-charter.md)／[01-roadmap.md](01-roadmap.md) |

---

## 1. 目的と位置づけ

現在の CTIIP は 25モジュール（**M01〜M25**）を要件定義し、
**DISCOVER → UNDERSTAND → ANALYZE → INNOVATE → UTILIZE** の流れを備えた設計原案（v0.1）が完成しています
（機能要件は [02-functional-requirements.md](../10-requirements/02-functional-requirements.md) に `FR-Mxx-nnn` として定義）。

この状態から「機能を少し足す」のではなく、**土木技術・研究・知財の経営判断基盤**として完成させるため、
以下の6領域を強化する **M26〜M50** の追加候補を定義します。

| 領域 | ねらい | 主な候補モジュール |
|---|---|---|
| ① 権利リスクをより深く調べる | 侵害・FTO の予備調査を組織的に行う | M28 M29 M30 M31 |
| ② 特許の変化・審査経過を追う | 補正・拒絶理由・権利変動の時系列を読む | M26 M27 M30 M31 |
| ③ 特許以外の技術情報をもっと結ぶ | 論文・NETIS・規格・図面・BIM/CIM まで横断 | M33 M34 M40 M47 M48 M50 |
| ④ R&D→PoC→現場導入を一気通貫にする | 仮説→実証→評価→採用/中止を管理 | M35 M36 M37 |
| ⑤ 経営判断につながる価値評価を追加する | 価値スコア・事業性・テーマ選定を支援 | M32 M37 M44 M45 |
| ⑥ AIそのものを監査・評価する | 根拠率・Hallucination・モデル比較を記録 | M49 |

---

## 2. 現状ベースライン（M01〜M25）

追加モジュールの参照元になる既存モジュールです（正本：`../10-requirements/02-functional-requirements.md`）。

| ID | モジュール（機能ブロック） | 柱 |
|---|---|---|
| M01 | Executive Dashboard | UTILIZE 補助（全柱の入り口） |
| M02 | Universal Search | DISCOVER |
| M03 | Technology Intelligence | DISCOVER |
| M04 | Patent Intelligence | DISCOVER |
| M05 | Prior Art Intelligence | ANALYZE |
| M06 | Claim Intelligence | UNDERSTAND |
| M07 | AI Patent Examiner | ANALYZE |
| M08 | Research & Paper Intelligence | DISCOVER |
| M09 | NETIS / Public Technology | DISCOVER |
| M10 | Competitor Intelligence | ANALYZE |
| M11 | Patent Landscape | ANALYZE |
| M12 | Civil Engineering Intelligence | UNDERSTAND |
| M13 | Field Application Intelligence | UTILIZE |
| M14 | R&D Intelligence | INNOVATE |
| M15 | Invention Management | INNOVATE |
| M16 | Licensing Intelligence | UTILIZE |
| M17 | IP Portfolio Management | UTILIZE |
| M18 | Legal Intelligence | UTILIZE |
| M19 | Monitoring & Watch | UTILIZE |
| M20 | Knowledge / RAG | UNDERSTAND |
| M21 | Autonomous AI Agents | 全柱（横断） |
| M22 | Workflow / Approval | 全柱（横断） |
| M23 | Reporting | 全柱（横断） |
| M24 | Data Management | 全柱（基盤） |
| M25 | Administration / Security / Audit | 全柱（基盤） |

実装状況の現状（2026-09-04時点）は、Web アプリ（`apps/web`）に主要画面群が実装されており、
MVP 環境（https://ctiip-mvp.mirai-dx-platform.com・ダミーデータ表示）が公開されています。
なお README の記載は「設計中（v0.1）・本番（https://ctiip.mirai-dx-platform.com）は未稼働」であり、
M01〜M25 の全機能実装はロードマップ（Phase 0〜4）に沿って進行中です。

---

## 3. 追加候補モジュール一覧（正本マスタ）M26〜M50

| ID | モジュール | 主な機能 | 既存の土台 | 優先度 |
|---|---|---|---|---|
| **M26** | Patent Citation Intelligence | 後方引用・前方引用・NPL引用・引用ネットワーク・重要特許抽出 | M04-004（引用関係保持）/M05-003 | 🔴最高 |
| **M27** | Patent Prosecution / Dossier Intelligence | 拒絶理由・Office Action・補正・意見書・審査経過の時系列解析 | M04-005（審査経過保持） | 🔴最高 |
| **M28** | FTO / Clearance Intelligence | FTO予備調査・製品/工法構成分解・Claim照合・国別リスク | M06 / M07 / M18（境界） | 🔴最高 |
| **M29** | IP Entity Intelligence | 出願人・権利者・発明者の名寄せ、企業グループ統合、権利移転追跡 | M04 / M10 / M24（データ品質） | 🔴最高 |
| **M30** | Claim Evolution Intelligence | 補正前後Claim差分・ファミリー間Claim差・権利範囲変化 | M06 | 🔴最高 |
| **M31** | Advanced Patent Family Intelligence | 優先権・分割・継続・各国移行・国別権利状態のファミリーツリー | M04-003＋DB `patent_families`／`GET /v1/patents/{id}/family`（既存） | 🟠高 |
| **M32** | IP Value & Quality Intelligence | 特許価値・技術価値・競争力・残存期間・被引用・コスト・戦略適合度 | M17 | 🔴最高 |
| **M33** | Technology Knowledge Graph | Patent・Paper・NETIS・技術・会社・発明者・現場・規格をGraph化 | M02〜M25 全体（横断） | 🔴最高 |
| **M34** | Standards & Specification Intelligence | JIS・ISO・国交省基準・設計施工基準・仕様書との関連付け | M09 / M12 | 🔴最高 |
| **M35** | Technology Readiness Intelligence | TRL・実証状況・施工実績・成熟度・導入難易度評価 | M03-004 / M13 | 🟠高 |
| **M36** | PoC / Experiment Management | 仮説→実証→評価→結果→採用/中止まで研究実証管理 | M14 / M13 | 🔴最高 |
| **M37** | Technology Business Case Intelligence | 導入費・削減工数・ROI・TCO・Payback・現場効果 | M32 / M23 | 🟠高 |
| **M38** | Safety & Quality Intelligence | 安全・品質リスク、新工法導入リスク、事故・不具合事例との照合 | M13 / M22（安全ゲート） | 🔴最高 |
| **M39** | GX / Environmental Intelligence | CO₂・燃料・資材・廃棄物・省人化・LCA等の技術比較 | M12 | 🟠高 |
| **M40** | BIM/CIM Technology Intelligence | IFC/BIM/CIMオブジェクトと工法・特許・NETIS・技術の関連付け | M48 / M12 | 🟠高 |
| **M41** | Research Partner Intelligence | 大学・研究機関・企業・Startup・研究者ネットワーク分析 | M08 | 🟠高 |
| **M42** | R&D Funding Intelligence | NEDO・JST・SIP・BRIDGE等の研究助成候補とのマッチング | M14 | 🟡中 |
| **M43** | Competitive Signal Intelligence | 特許以外の競合兆候（論文・ニュース・採用・技術発表・共同研究等） | M10 / M08 / M19 | 🟠高 |
| **M44** | Technology Transfer Pipeline | Buy / Build / Partner / License / Joint-R&D の案件管理 | M16 / M17 | 🟠高 |
| **M45** | Innovation Opportunity Intelligence | White Space＋市場性＋競合＋知財＋現場ニーズから研究候補ランキング | M11 / M14 / M10 / M13 | 🔴最高 |
| **M46** | Multilingual Patent Intelligence | 日英中韓等の特許翻訳・Claim対訳・専門用語辞書 | M02 / M04 / M06 | 🟠高 |
| **M47** | Patent Drawing / Image Intelligence | 特許図面解析・部品認識・図面類似検索・説明番号との対応 | M04 / M06 | 🟠高 |
| **M48** | Engineering Document Intelligence | PDF・CAD図・BIM・写真・スケッチから技術要素抽出→特許検索 | M02 / M03 / M04 / M09 | 🔴最高 |
| **M49** | AI Governance & Evaluation | AI回答品質・根拠率・Hallucination・モデル/Prompt版・再現性評価 | ADR-0006（`ai_runs`/`ai_citations`）／M25 | 🔴最高 |
| **M50** | Technology Ontology / Taxonomy Management | 工種・工法・構造物・材料・機械・IPC/CPC・NETIS分類体系管理 | M12（`civil_classifications`）／M24 | 🔴最高 |

> 🔴最高＝第一拡張群候補／🟠高＝第二拡張群候補／🟡中＝必要に応じて検討、の目安。
> 優先度の決定と採否は **⚠️ 要決定（決裁）**です。

---

## 4. モジュール別詳細（優先度の高いモジュール）

### 4.1 M26 Patent Citation Intelligence 🔴

「どの特許がどの特許・論文を引用しているか」をグラフとして扱う機能を独立モジュール化します。

- **機能**: 後方引用／前方引用／NPL引用の収集、引用ネットワークの可視化、重要特許（基盤特許・ハブ）抽出、引用急増特許の検出
- **分析の例**: 技術の原点／基盤特許／後発企業／技術継承／自社特許を引用している競合企業／学術論文→特許の技術移転
- **既存との関係**: `FR-M04-004`（引用・被引用の保持）と `FR-M05-003`（引用関係分析）は土台。**分析レイヤー（グラフ＋AI要約）を追加**する
- **効果**: M10 Competitor Intelligence・M11 Patent Landscape の精度を直接強化する
- **原則**: 引用関係は事実データとして提示し、「重要」判定はスコア＋理由で示す（決定はしない）

### 4.2 M27 Patent Prosecution / Dossier Intelligence 🔴

「登録された特許」だけでなく「どうやって登録に至ったか」を時系列で読む機能です。

- **対象フロー**: 出願 → 審査請求 → 拒絶理由通知 → 補正 → 意見書 → 再審査 → 登録
- **重要出力**: 「最初は広かった Claim が、審査で何を削られ／限定されて登録されたか」→ 競合特許の真に守られている範囲が見える
- **データ源の実現性**: 国内は JPO 特許情報取得 API（出願・経過情報、2026-03 にアクセス上限引き上げ）／IP5 ドシエは JPO OPD／世界は EPO OPS（European Patent Register）を利用可能（§6 参照）
- **既存との関係**: `FR-M04-005`（法的状態・審査経過の保持）を土台に時系列解析を追加
- **境界**: 権利解釈の最終判断は法務・弁理士。CTIIP は「変化の可視化＋要因候補の提示」まで

### 4.3 M28 FTO / Clearance Intelligence 🔴

新しい施工装置・工法を対象にした Freedom to Operate の**予備調査**を支援します。

- **機能**: 対象を技術構成要素（例：制御装置／油圧機構／位置検出／施工方法／安全制御）に分解 → 要素ごとに関連特許を検索 → 他社 Claim と照合 → 国別の権利状態と AI 類似度を表で提示
- **表示例**: 構成要素 × 関連特許 × Claim × 権利状態 × AI類似度 × 対応（🔴専門確認／🟠要確認／🟢参考）
- **重要な原則**: **AI は侵害と判定しない**。類似度は「侵害判断ではない」旨の注記を常時併記（`FR-M06-020` と同じUI制約）
- **最終判断の流れ**: CTIIP FTO予備調査 → 人間レビュー → `Construction-LegalOps-DX` → 法務・弁理士（[03-scope-boundary.md](../00-overview/03-scope-boundary.md) の引き渡し I-01〜I-04 までを CTIIP スコープとする）

### 4.4 M29 IP Entity Intelligence 🔴

企業・機関・人名の**名寄せと企業グループ統合**の精度を上げる、地味だが競合分析の土台となる機能です。

- **対象**: `ABC建設株式会社`／`ABC CONSTRUCTION CO., LTD.`／`株式会社ABC建設` 等の表記ゆれ統合、親子会社・グループ会社の束ね、権利移転の追跡
- **必要性**: 名寄せが不十分だと「競合A社は特許20件」の回答が子会社を含めると120件、という事故が起きる
- **既存との関係**: M24 データ管理（名寄せ）の高度化として実装し、M04/M10 の集計・分析精度を担保する
- **原則**: 名寄せ結果の自動確定は行わず、確認候補（高確信→自動、低確信→人間確認）として提示する

### 4.5 M30 Claim Evolution Intelligence 🔴

M06 Claim Intelligence を強化し、**補正前後の Claim 差分**を見せます。

- **機能**: 出願時／拒絶理由対応後／登録時の Claim を比較し、追加・限定された要素を diff 表示
- **出力例**: 「この特許は審査過程で『港湾』『GPS』『油圧』に限定された可能性が高い」と技術担当へ提示
- **既存との関係**: `FR-M06-001〜008`（Claim 構造化・分解）を前提に**版間比較**を追加
- **境界**: 補正経緯の法的評価は LegalOps 側。CTIIP は差分事実＋解釈候補の提示

### 4.6 M31 Advanced Patent Family Intelligence 🟠

特許ファミリー機能そのものは既存（`patent_families` テーブル・`GET /v1/patents/{id}/family`）です。ここでは**高度分析**を追加します。

- **機能**: JP→PCT→US/EP/CN/KR→分割 の Tree 表示、各国の権利状態・Claim 差・出願戦略・放棄国・分割・優先権・残存期間の比較
- **既存との関係**: DB 設計 `docs/30-design/02-database-design.md`（`family_id`・`patent_families`）、API 仕様 `docs/30-design/03-api-specification.md` に土台あり
- **データ源**: EPO OPS の Patent Family・Legal Status（§6）で海外分を補完

### 4.7 M32 IP Value & Quality Intelligence 🔴

M17 IP Portfolio Management を**経営判断向け**に強化します。

- **機能**: 特許ごとに Technology Score／Patent Strength／Market Potential／Competitor Importance／Field Applicability／Remaining Life／Cost を統合した Strategic Score を提示
- **出力例**: 維持／ライセンス／追加出願／共同研究／売却候補／放棄検討の**検討候補**をスコア根拠付きで提示
- **原則**: AI は「放棄しろ」と決定しない。最終判断は知財委員会・経営

### 4.8 M33 Technology Knowledge Graph 🔴

特許・論文・NETIS・技術・会社・発明者・現場・規格を**1つのグラフ**でつなぐ、CTIIP 全体の中核候補です。

- **グラフの例**: `Paper —cites→ Patent —protects→ Technology —used_at→ Site —associated→ NETIS`、`Company —owns→ Patent`、`Researcher —works_at→ Institution`
- **可能になる質問**: 「この工法に関係する特許・論文・NETIS・会社・研究者・実証現場を全部見せて」
- **既存との関係**: M02/M03/M04/M08/M09/M12/M13/M14/M15/M16/M17/M19 の個別データを横断する検索・表示レイヤー
- **実装余地**: 既存 RDB を主軸に、関連テーブル（特許⇔技術⇔NETIS⇔現場）のリンク充実とグラフ検索API（n-hop）で段階的に構築する

### 4.9 M34 Standards & Specification Intelligence 🔴

土木技術は特許だけで導入できません。規格・基準への適合が見えることが建設会社ならではの差別化になります。

- **対象**: JIS・ISO・国交省要領・設計基準・施工基準・発注仕様・自治体仕様・安全基準
- **機能**: Patent＋NETIS＋Paper＋Standard/Guideline をまとめて検索・関連付け
- **既存との関係**: M09（NETIS・国交省公開情報）と M12（土木分類）の拡張として規格台帳を新設

### 4.10 M36 PoC / Experiment Management 🔴

M14 R&D テーマ管理の次の段階（**仮説→実証→評価→採用/中止**）を管理します。

- **フロー**: 現場課題 → 技術候補 → R&Dテーマ → PoC計画 → 実証 → 結果 → 技術評価 → 知財評価 → 現場導入
- **管理項目**: 仮説・KPI（工数/品質/安全/CO₂）・Before/After・実証費・エビデンス（写真/動画/計測）・関連知財・結果（成功/部分成功/失敗）・レッスン
- **効果**: **失敗した PoC も会社資産**として蓄積できる
- **既存との関係**: M14（テーマ）→ M36（実証）→ M13（現場適用）の導線を一本化

### 4.11 M38 Safety & Quality Intelligence 🔴

新技術の現場導入前に、安全・品質の観点からリスク候補をまとめるゲート機能です。

- **機能**: 新技術 → 施工方法 → 類似事故・不具合事例 → 安全基準 → NETIS評価 → 論文 の順にリスク候補を照合
- **既存との関係**: M13 Field Application Intelligence と連携し、**安全・品質担当者が止める Gate** を M22 承認ワークフロー上に維持する

### 4.12 M45 Innovation Opportunity Intelligence 🔴

M11 Patent Landscape の White Space を一段進め、**研究テーマ候補のランキング**を提示します。

- **入力**: Patent White Space＋現場ニーズ＋競合強度＋論文増加率＋NETIS＋市場性＋Safety＋GX＋開発難易度
- **出力例**: 港湾施工自動化 91／水中点検AI 88／重機遠隔操作 85／コンクリート養生AI 78（Innovation Opportunity Score）
- **利用想定**: 経営企画＋技術研究＋知財の共通画面
- **原則**: スコアは「検討候補の並び替え材料」。テーマ決定は経営・技術委員会

### 4.13 M49 AI Governance & Evaluation 🔴

「AI は決定しない」「根拠を追跡可能にする」という CTIIP の思想（ADR-0006 Provenance ファースト）を**評価可能にする**機能です。

- **記録項目**: Model／Prompt Version／Skill Version／検索Query／参照Documents／Citation Coverage／Confidence／Hallucination Check／Human Review／最終評価
- **モデル比較**: 同一タスクを複数モデル（Claude / GPT / DeepSeek / Workers AI 等）で実行し精度比較
- **既存との関係**: `ai_runs`／`ai_citations`（ADR-0006）と M25 監査ログを土台に、評価テーブルと比較実行基盤を追加

---

## 5. 第二拡張群以降（概要）

| ID | モジュール | 補足（要点） |
|---|---|---|
| M35 | Technology Readiness Intelligence | TRL・施工実績・成熟度。M03-004 の高度化 |
| M37 | Technology Business Case Intelligence | ROI/TCO/Payback。M32 とセットで設計する |
| M39 | GX / Environmental Intelligence | 従来工法との CO₂・工期・省人化比較 |
| M40 | BIM/CIM Technology Intelligence | IFC/BIM/CIM と工法・特許・NETIS の関連付け |
| M41 | Research Partner Intelligence | 大学・研究機関・Startup・研究者ネットワーク |
| M42 | R&D Funding Intelligence | 助成制度とのマッチング（🟡中） |
| M43 | Competitive Signal Intelligence | 特許以外の競合兆候を時系列で検知（M19 Watch と統合） |
| M44 | Technology Transfer Pipeline | Buy/Build/Partner/License/Joint-R&D 案件管理 |
| M46 | Multilingual Patent Intelligence | 日英中韓の翻訳・Claim対訳・用語辞書 |
| M47 | Patent Drawing / Image Intelligence | 特許図面の部品認識・類似図面検索（Vision AI） |
| M48 | Engineering Document Intelligence | PDF/CAD/BIM/写真/スケッチから技術要素抽出→横断検索 |
| M50 | Technology Ontology / Taxonomy Management | 工種・工法・構造物・材料・機械・IPC/CPC・NETIS 分類の体系管理。M12 の `civil_classifications` を発展させ、全モジュールの検索精度を底上げ |

> M47/M48 は建設特許特有の価値が大きい一方、Vision AI 基盤と学習データ整備が必要なため
> 実装コストを見積もってから採否を判断します（⚠️ 要決定）。

---

## 6. 外部データ基盤の拡充

現状の外部データ方針（ロードマップ Phase 0「外部データ源の選定」・Phase 1「外部データ取り込み」）を拡張し、
**JPO のみに依存しない**複数データ源の利用を候補とします。

| データ源 | 主用途 | 依存しやすいモジュール | 参照 |
|---|---|---|---|
| JPO 特許情報取得 API | 日本特許の書誌・経過情報の機械取得（2026-03 にアクセス上限引き上げ） | M27 M04 M19 | https://ip-data.jpo.go.jp/pages/top_e.html |
| JPO OPD | IP5 審査ドシエ（Office Action 等） | M27 M30 | https://www.jpo.go.jp/ |
| EPO OPS | 世界特許・Patent Family・Legal Status・Full Text・CPC・European Patent Register | M31 M26 M28 | https://www.epo.org/en/searching-for-patents/data/web-services/ops |
| WIPO PATENTSCOPE | PCT・国際特許・NPL を含む検索（Family 単位表示） | M02 M04 M31 | https://patentscope.wipo.int/ |
| WIPO IP API Catalog | Family／Legal Status／Licensing／Office Action 等の API データ種別整理 | 全知財系 | https://www.wipo.int/en/web/standards/ip-api-catalog |
| Crossref | 論文メタデータ | M08 | https://www.crossref.org/documentation/ |
| OpenAlex | 論文・研究者・機関の Graph | M08 M33 M41 | https://docs.openalex.org/ |
| CiNii Research | 国内研究情報 | M08 M41 | https://cir.nii.ac.jp/ |
| J-STAGE | 国内論文 | M08 | https://www.jstage.jst.go.jp/ |
| NETIS | 国内建設新技術 | M09 M34 M38 | https://www.netis.mlit.go.jp/ |
| 国交省公開資料 | 技術・基準・要領 | M09 M34 | https://www.mlit.go.jp/ |
| e-Gov | 法令 | M18 M34 | https://www.e-gov.go.jp/ |
| JIS／ISO 等 | 規格メタデータ | M34 M50 | https://www.jisc.go.jp/ ／ https://www.iso.org/ |

> 各データ源の契約・利用条件・API 上限はロードマップ Phase 0 の手順に沿って確認します（⚠️ 要決定）。

---

## 7. 機能追加より先に解消すべき事項

機能追加（M26〜M50）の前に、以下を優先して解消します。特に **#11 は最優先**です。

| Issue | 内容 | 判断 |
|---|---|---|
| [#11](https://github.com/Kensan196948G/Civil-Technology-IP-Intelligence-Platform/issues/11) | C3/C4 機密区分の行レベル制御未実装 | 🔴 **本番前必須** |
| [#10](https://github.com/Kensan196948G/Civil-Technology-IP-Intelligence-Platform/issues/10) | Next.js 14→15 移行／既知 High CVE 対応 | 🔴 セキュリティ優先 |
| [#13](https://github.com/Kensan196948G/Civil-Technology-IP-Intelligence-Platform/issues/13) | Responsive / A11y 改善 | 🟡 後続 |

**#11 の設計方針（徹底事項）**: このシステムは「出願前発明」等の極めて機密性の高い情報を扱うため、
権限のない利用者には「403 Forbidden」ではなく**存在自体を見せない（404／件数にも含めない）**方針を
実装まで徹底します（`../10-requirements/05-rbac-matrix.md` §4 と整合）。

> **追記（2026-09-04）**: `main` ブランチの CI（quality ジョブの Cloudflare Pages build (next-on-pages) verification ステップ）が
> 失敗状態でしたが、原因を特定しました。`@cloudflare/next-on-pages` v1.13.16 は**非静的ルートすべてに
> `export const runtime = 'edge'` を要求**します。一方 `2bf88d1` は本番を Node ランタイム＋ローカル PostgreSQL＋
> Cloudflare Tunnel 構成へ移行するため edge 宣言を全削除しており、**現行アーキテクチャとは両立不能**です
> （`next build` 自体は force-dynamic 化により成功し、cf:build の変換段階のみが失敗する状態）。
> 対応の選択肢: **案A** CI の next-on-pages 検証ステップを撤去し `next build`＋スモークで代替（現行アーキテクチャに整合・推奨）／
> **案B** CF Pages デプロイへ回帰（edge 宣言復元＋Neon HTTP ドライバ運用）。
> 本件の扱いは **⚠️ 要決定（D-5）** です。

---

## 8. 実装順序（優先順位案）

| 順位 | 機能 | 理由 |
|---|---|---|
| **0** | C3/C4 Row Level Security（#11） | 本番利用の前提 |
| **1** | M28 FTO Intelligence | 知財実務上の価値が非常に高い |
| **2** | M27 Prosecution Intelligence | Claim の本当の意味が見える |
| **3** | M26 Citation Intelligence | 技術系譜・重要特許の分析 |
| **4** | M29 Entity Intelligence | 競合分析精度の土台 |
| **5** | M33 Knowledge Graph | CTIIP 全体をつなぐ中核 |
| **6** | M34 Standards Intelligence | 建設業特化として重要 |
| **7** | M36 PoC Management | R&D→実用化を接続 |
| **8** | M38 Safety/Quality Intelligence | 現場導入の Gate |
| **9** | M45 Opportunity Intelligence | 経営・研究テーマ選定 |
| **10** | M49 AI Governance | AI 利用の信頼性確保 |
| **11** | M30 Claim Evolution | FTO・審査解析を強化 |
| **12** | M32 IP Value | 経営判断を支援 |
| **13** | M50 Ontology | AI 検索精度を向上 |
| **14** | M47/M48 図面・CAD/BIM AI | 建設特許向けの差別化 |
| **15以降** | M35 M37 M39 M40 M41 M42 M43 M44 M46 M31 | 順次高度化 |

> 推奨の**第一拡張群**は **M26〜M34 ＋ M36 ＋ M49**（優先順位0〜10 とほぼ一致）。ここまで実装すると
> 「建設土木向け Technology Intelligence / IP Intelligence の統合基盤」としての形が揃います。
> 第一拡張群の**採否・着手時期は ⚠️ 要決定（決裁）**です。

---

## 9. 最終形（目指す全体像）

```text
外部技術情報（特許・論文・NETIS・規格・研究・競合・公開技術）
        │
        ▼
   CTIIP Technology Graph（M33 を中核とした横断基盤）
        │
  ┌─────┼──────────┐
  ▼     ▼          ▼
現場課題  R&D / PoC  発明・知財
  │     │          │
  └─────┴────┬─────┘
             ▼
      AI Intelligence（FTO／競合分析／技術評価）
             │
             ▼
          人間承認（Gate）
             │
     ┌───────┴────────┐
     ▼                ▼
 現場導入・R&D    Construction-LegalOps-DX（法務・弁理士）
```

**循環の成立**: 「世界の技術を探す」→「理解する」→「自社技術と比較する」→「権利リスクを調べる」→「PoCする」→
「現場で使う」→「発明が生まれる」→「知財化する」→「その知財を再び技術探索に使う」。

---

## 10. 決定待ち事項（⚠️ 要決定）

| # | 決定事項 | 決定者（想定） | 期限 |
|---|---|---|---|
| D-1 | M26〜M50 のうち、どのモジュールをチャーターのスコープ（In Scope）に含めるか | 01 経営／06 管理本部 | 次期フェーズ計画時 |
| D-2 | 第一拡張群（M26〜M34＋M36＋M49）の着手順とリソース配分 | 01 経営／04 技術・研究開発 | 同上 |
| D-3 | 採用モジュールの機能要件化（`FR-Mxx-nnn` 追記）と DB 設計・Issue 化の進め方 | 開発リード | 採否決定後 |
| D-4 | 外部データ源（§6）の契約・利用条件の確認対象と優先順位 | 04 技術・研究開発／06 管理本部 | Phase 0 手順に従う |
| D-5 | `main` CI の next-on-pages 検証ステップの扱い（修正 or 廃止） | 開発リード | 可及的速やか |
| D-6 | README §16 と `05-rbac-matrix.md` §4 の行レベル制御に関する不整合の正（#11 に同旨） | ユーザー／プロダクトオーナー | #11 着手前 |

---

## 11. 関連ドキュメント

- 機能要件（M01〜M25）: `../10-requirements/02-functional-requirements.md`
- ロードマップ: `01-roadmap.md`（本計画は「継続（Phase 4 以降）」の拡張を具体化したもの）
- プロジェクト憲章: `../00-overview/01-project-charter.md`
- 責任境界（LegalOps-DX）: `../00-overview/03-scope-boundary.md`
- RBAC / 機密区分: `../10-requirements/05-rbac-matrix.md`
- DB 設計（`patent_families`・`classification`）: `../30-design/02-database-design.md`
- API 仕様（Family 取得等）: `../30-design/03-api-specification.md`
- Provenance 方針: `../20-architecture/adr/ADR-0006-provenance-first.md`
- GitHub Issues: [#10](https://github.com/Kensan196948G/Civil-Technology-IP-Intelligence-Platform/issues/10)・[#11](https://github.com/Kensan196948G/Civil-Technology-IP-Intelligence-Platform/issues/11)・[#13](https://github.com/Kensan196948G/Civil-Technology-IP-Intelligence-Platform/issues/13)
