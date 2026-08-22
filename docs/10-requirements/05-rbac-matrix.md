# 🔐 権限マトリクス（RBAC）

## 1. ロール定義

| ロール | コード | 主な所属部署 |
|---|---|---|
| 一般技術者 | `engineer` | 営業、施工・作業所、支店、船舶事業部 |
| 技術管理者 | `tech_manager` | 技術・研究開発、安全品質環境、支店技術長 |
| R&D担当 | `rnd` | 技術・研究開発 |
| 知財担当 | `ip` | 技術・研究開発、管理本部 |
| 法務担当 | `legal` | 管理本部 |
| 経営者 | `executive` | 経営・統治・委員会 |
| システム管理者 | `sysadmin` | 管理本部 |
| 閲覧専用 | `viewer` | 監査、外部委託 |

## 2. 操作記号

`R`=参照 / `W`=作成・編集 / `A`=承認 / `X`=エクスポート / `-`=不可

## 3. モジュール別権限

| モジュール | engineer | tech_manager | rnd | ip | legal | executive | sysadmin | viewer |
|---|---|---|---|---|---|---|---|---|
| M01 Dashboard | R | R | R | R | R | R | R | R |
| M02 Universal Search | R | R | R | R | R | R | R | R |
| M03 Technology | R | R/W | R | R | R | R | R | R |
| M04 Patent | R | R/W | R | R/W | R | R | R | R |
| M05 Prior Art | R | R/W/A | R/W | R/W/A | R | R | R | - |
| M06 Claim | R | R/W | R | R/W/X | R | R | R | - |
| M07 AI Examiner | - | R/W | R | R/W/A | R | R | R | - |
| M08 Research | R | R/W | R/W | R | R | R | R | R |
| M09 NETIS | R | R/W | R | R | R | R | R | R |
| M10 Competitor | - | R | R/W | R | - | R | R | - |
| M11 Landscape | - | R | R/W | R | - | R | R | - |
| M12 Civil Intelligence | R | R/W | R | R | - | R | R | R |
| M13 Field Application | R/W | R/W/A | R | R | - | R | R | - |
| M14 R&D | - | R | R/W | R | - | R/A | R | - |
| M15 Invention | W（自分の届出） | R/W/A | R | R/W/A | R | R/A | R | - |
| M16 Licensing | - | R | R | R/W | R | R/A | R | - |
| M17 IP Portfolio | - | R | R | R/W | R | R | R | - |
| M18 Legal | - | R | - | R/W | R/W/A | R | R | - |
| M19 Monitoring | R/W（自分のWatch） | R/W | R/W | R/W | R | R | R | - |
| M20 Knowledge / RAG | R | R | R | R | R | R | R | R |
| M21 Autonomous Agents | - | R/W | R/W | R/W | - | R | R | - |
| M22 Workflow | R/W（自分の案件） | R/W/A | R/W | R/W/A | R/A | A | R | R |
| M23 Reporting | R | R/W/X | R/W/X | R/W/X | R/X | R/X | R | - |
| M24 Data Management | - | R/W | R | R/W | - | - | R/W | - |
| M25 Administration | - | - | - | - | - | R | R/W | - |

**注**: 上表は機能レベルの上限。実際の可視範囲は §4 の行レベル制御でさらに絞られる。

## 4. 行レベル制御（データ分類 × 権限）

| 分類 | 内容 | 既定の可視範囲 |
|---|---|---|
| **C1 公開** | 公開特許・論文・NETIS・技術基準 | 全ロール |
| **C2 社内** | 技術台帳・施工実績・過去調査・AIレビュー | 全ロール（`viewer` は指定範囲のみ） |
| **C3 機密** | 出願前の発明、Claim候補、競合評価 | **プロジェクト参加者のみ**。検索結果にも出さない |
| **C4 最高機密** | 未公開の重要発明、係争関連 | 個別付与された利用者のみ。監査ログ強化 |

**MUST**: C3/C4 は権限のない利用者に対し「存在も見せない」（件数にも含めない）。

## 5. 特別な制御

| 対象 | 制御 |
|---|---|
| エクスポート（X） | 機密区分 C3 以上は `ip` / `tech_manager` のうち明示付与された者のみ。全件を監査ログへ記録し、透かしを付与する |
| 一括ダウンロード | 件数上限を設ける（⚠️ 上限値は要決定）。超過時は申請制 |
| AIへの送信 | C4 は既定で送信しない。C3 は AI送信ポリシーで定めた範囲のみ |
| 管理者操作 | 権限付与・削除・監査ログ設定変更は再認証を要求 |
| 承認（A） | 自分が起案した案件を自分で承認できない（自己承認の禁止） |
| 新技術の現場導入 | 安全・品質・環境部門ロールの承認を必須とする（迂回不可） |

## 6. 承認フローとロールの対応

| ステータス遷移 | 承認ロール |
|---|---|
| Draft → Researching | `engineer` / `tech_manager`（起案者） |
| Researching → AI Reviewed | システム（自動）。ただし次段へは人の確認が必要 |
| AI Reviewed → Technical Review | `tech_manager` |
| Technical Review → IP Review | `ip` |
| IP Review → Legal Review | `legal` |
| Legal Review → Approved | `executive`（案件区分により `ip` へ委任可） |
| 任意 → Rejected / Hold | 各段の承認ロール |
| Approved → Archived | `sysadmin` / `ip` |
| 現場導入の可否 | 安全・品質・環境部門の `tech_manager`（専用フラグ） |

⚠️ **要決定** — 委任ルールと金額・重要度による決裁権限の閾値。Phase 2 までに規程と整合させる。
