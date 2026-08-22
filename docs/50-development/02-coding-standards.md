# 📏 コーディング規約

## 1. 全般

| 項目 | 規約 |
|---|---|
| 言語 | TypeScript。`any` を使わない（やむを得ない場合は `unknown` + 絞り込み） |
| `strict` | 有効。`noUncheckedIndexedAccess` も有効 |
| フォーマッタ | Prettier（設定はリポジトリ共通） |
| Linter | ESLint。警告もCIで失敗させる |
| コメント | 英語可。**なぜそうしたか**を書く。何をしているかはコードで示す |
| UI文言 | 日本語 |
| ファイル名 | `kebab-case.ts`。React コンポーネントは `PascalCase.tsx` |

## 2. 命名

| 対象 | 規約 | 例 |
|---|---|---|
| 変数・関数 | `camelCase` | `calculateFieldScore` |
| 型・クラス | `PascalCase` | `AccessContext` |
| 定数 | `SCREAMING_SNAKE_CASE` | `MAX_CHUNK_LENGTH` |
| DB テーブル・列 | `snake_case` | `ai_citations` |
| API パス | `kebab-case` の複数形 | `/v1/prior-art/studies` |
| 環境変数 | `SCREAMING_SNAKE_CASE` | `DATABASE_URL` |
| Boolean | `is` / `has` / `can` で始める | `isEstimated`, `canExport` |

**業務用語は用語集に合わせる**（[../00-overview/02-glossary.md](../00-overview/02-glossary.md)）。
「請求項」は `claim`、「構成要件」は `claimElement`、「工種」は `workType`。訳語を揺らさない。

## 3. 型

```ts
// ✅ 判別可能ユニオンで状態を表す
type JobState =
  | { status: 'queued' }
  | { status: 'running'; progress: number }
  | { status: 'succeeded'; result: Result; citations: Citation[] }
  | { status: 'failed'; error: string }

// ❌ optional の乱用は状態を表現できない
type Bad = { status: string; result?: Result; error?: string }
```

- API の入出力は Zod スキーマから型を導出する（`z.infer`）
- DB の型は Drizzle のスキーマから導出する
- 手書きの重複した型定義を作らない

## 4. エラー処理

```ts
// ✅ 業務エラーは型で表す
class WorkflowError extends Error {
  constructor(public code: WorkflowErrorCode, message: string) { super(message) }
}

// ✅ 呼び出し側が扱える情報を持たせる
throw new WorkflowError(
  'SELF_APPROVAL_FORBIDDEN',
  '起案者はご自身の案件を承認できません。別の承認者を指定してください。'
)
```

| 規約 | 内容 |
|---|---|
| 握りつぶし禁止 | `catch` して何もしない実装を書かない |
| ログ | エラーは相関IDとともに記録する。機密本文を含めない |
| 利用者向け文言 | 日本語。原因と次の操作を示す。謝罪・曖昧表現を避ける |
| 内部詳細 | スタックトレースを利用者に返さない |

## 5. 非同期

```ts
// ✅ 並列可能なものは並列に
const [patents, papers] = await Promise.all([fetchPatents(), fetchPapers()])

// ❌ ループ内の逐次 await（Worker のサブリクエスト上限にも注意）
for (const id of ids) { await fetchOne(id) }
```

| 規約 | 内容 |
|---|---|
| 浮いた Promise | 禁止。`await` するか `ctx.waitUntil()` に渡す |
| タイムアウト | 外部呼び出しには必ずタイムアウトを設定する |
| 再試行 | 一時的な失敗のみ再試行する。4xx は再試行しない |
| N+1 | DB へのループ問い合わせを作らない。バッチ取得する |

## 6. React / Next.js

| 規約 | 内容 |
|---|---|
| Server Component 優先 | データ取得はサーバ側で行う |
| `use client` | 必要な葉のコンポーネントにのみ付ける |
| フェッチ | クライアントから直接DBに触れない。必ず API 経由 |
| 状態 | サーバ状態とクライアント状態を混同しない |
| フォーム | 検証は Zod スキーマをサーバと共有する |
| 表示 | 権限のない項目は**非表示**にする（グレーアウトにしない） |

## 7. SQL / DB

| 規約 | 内容 |
|---|---|
| クエリ | `packages/db` のヘルパ経由。生SQLの直書きは lint で検出 |
| 権限 | WHERE 句に権限条件を必ず含める。取得後のフィルタ禁止 |
| N+1 | JOIN またはバッチ取得で解消する |
| トランザクション | 短く保つ。外部API呼び出しをトランザクション内に入れない |
| マイグレーション | 加算のみ・後方互換のみ。目的とロールバック手順をコメントに書く |

## 8. AI 関連

| 規約 | 内容 |
|---|---|
| プロンプト | `packages/ai/prompts/` に版付きで置く。コード中に埋め込まない |
| 出力検証 | Zod で必ず検証する。検証を通らない出力を保存しない |
| 引用 | 原文からの機械的な切り出し。AIに生成させない |
| 入力の区切り | 利用者入力を明示的にデータとして区切り、指示として解釈させない |
| モデルID | 設定から読む。コードに直書きしない |
| コスト | トークン量を必ず記録する |

## 9. テスト

| 種別 | 対象 | 方針 |
|---|---|---|
| 単体 | `packages/core` のロジック | 純粋関数として網羅的に |
| 結合 | API + DB | Neon ブランチに対して実行 |
| E2E | 主要ユースケース | Playwright |
| 権限 | 権限マトリクスの全組合せ | 拒否が正しく効くことを確認 |
| Provenance | AI実行パス | `ai_citations` が作られることを確認 |

**MUST**: 権限テストと Provenance テストは、機能追加時に必ず追加する。

## 10. 禁止事項

| # | 禁止 |
|---|---|
| 1 | `any` の使用（例外はレビューで承認したもののみ） |
| 2 | シークレットのハードコード |
| 3 | 権限判定の後段フィルタ |
| 4 | AI に引用文を生成させる |
| 5 | ワークフロー遷移のコード直書き |
| 6 | UI 注記を prop で無効化できる設計 |
| 7 | 監査ログの UPDATE / DELETE |
| 8 | `console.log` に機密データを出力 |
| 9 | main への直接 push |
| 10 | CI 未通過でのマージ |
