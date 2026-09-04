# 🔁 CI/CD パイプライン

> **現状（2026-08-29 移行）**: 実行基盤が自社ホスト（Next.js Node ＋ ローカル PostgreSQL ＋ Cloudflare Tunnel）へ移行したため、
> 本ファイル中の **Neon ブランチ（db-preview 等）・preview Worker デプロイの記述は移行前のもの**で、現行は運用していません。
> 実際のワークフローは `.github/workflows/`（`ci.yml`・`deploy-production.yml`）が正です（[ADR-0007](../20-architecture/adr/ADR-0007-local-postgresql.md)）。
> マイグレーションは main 反映後にデプロイ先ホストで `pnpm db:migrate` を実行します。

## 1. 全体像（移行前の目標設計を含む）

```text
PR 作成/更新
  ├─ ci.yml            lint / typecheck / test / build / secret scan / dep audit
  ├─ db-preview.yml    Neon ブランチ pr-{n} 作成 → マイグレーション → ロールバック検証
  └─ deploy-preview.yml Worker preview デプロイ → E2E（主要導線）

main へマージ
  └─ deploy-mvp.yml mvp デプロイ → マイグレーション → スモークテスト

タグ v*
  └─ deploy-production.yml 🔒 承認 → 本番マイグレーション → デプロイ → スモークテスト

PR クローズ
  └─ cleanup.yml       Neon ブランチ削除 / preview Worker 削除

定期
  └─ scheduled.yml     依存監査 / preview 残存チェック / データ品質レポート
```

## 2. 品質ゲート（必須チェック）

| チェック | 内容 | 失敗時 |
|---|---|---|
| `lint` | ESLint。警告も失敗扱い | ブロック |
| `typecheck` | `tsc --noEmit` | ブロック |
| `test` | 単体・結合 | ブロック |
| `build` | 全アプリ・Worker のビルド | ブロック |
| `secret-scan` | シークレット検出 | ブロック |
| `dep-audit` | 依存の脆弱性。critical / high はゼロ | ブロック |
| `db-migrate` | マイグレーション適用とロールバック検証 | ブロック |
| `e2e` | 主要ユースケース | ブロック |
| `authz-test` | 権限マトリクスの網羅テスト | ブロック |
| `provenance-test` | AI実行での `ai_citations` 生成 | ブロック |

**MUST**: これらを迂回してマージしない。保護規則を無効化しない。

## 3. ci.yml（骨子）

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test -- --coverage
      - run: pnpm build
      - name: Secret scan
        run: pnpm run scan:secrets
      - name: Dependency audit
        run: pnpm audit --audit-level=high
```

## 4. db-preview.yml（骨子）

```yaml
name: DB Preview
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: preview
    steps:
      - uses: actions/checkout@v4
      - name: Create Neon branch
        run: node scripts/neon-branch.mjs create "pr-${{ github.event.number }}"
        env:
          NEON_API_KEY: ${{ secrets.NEON_API_KEY }}
      - name: Apply migrations
        run: pnpm db:migrate
        env:
          DATABASE_URL_DIRECT: ${{ steps.branch.outputs.direct_url }}
      - name: Verify rollback
        run: pnpm db:rollback:verify
```

**MUST**: ロールバック検証を必ず行う。適用できても戻せないマイグレーションを本番へ出さない。

## 5. deploy-preview.yml（骨子）

```yaml
name: Deploy Preview
on:
  pull_request:

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: preview
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - name: Deploy workers (preview)
        run: pnpm run deploy:preview -- --name-suffix "pr${{ github.event.number }}"
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      - name: E2E
        run: pnpm test:e2e
        env:
          BASE_URL: ${{ steps.deploy.outputs.url }}
      - name: Comment URL on PR
        uses: actions/github-script@v7
```

## 6. deploy-production.yml（骨子）

```yaml
name: Deploy Production
on:
  push:
    tags: ['v*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production      # 🔒 Required reviewers を設定する
    steps:
      - uses: actions/checkout@v4
      - name: Verify tag is on main
        run: git merge-base --is-ancestor ${{ github.sha }} origin/main
      - name: Apply migrations (additive only)
        run: pnpm db:migrate
        env:
          DATABASE_URL_DIRECT: ${{ secrets.DATABASE_URL_DIRECT }}
      - name: Deploy workers
        run: pnpm run deploy:prod
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      - name: Smoke test
        run: pnpm test:smoke
        env:
          BASE_URL: https://ctiip.mirai-dx-platform.com
      - name: Create release notes
        uses: actions/github-script@v7
```

**MUST**:
- `environment: production` に **Required reviewers** を設定し、承認なしにデプロイできないようにする
- タグが `main` の祖先であることを検証する（検証済みコミット以外を本番へ出さない）

## 7. cleanup.yml

```yaml
name: Cleanup
on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Delete Neon branch
        run: node scripts/neon-branch.mjs delete "pr-${{ github.event.number }}"
      - name: Delete preview workers
        run: pnpm run deploy:preview:delete -- --name-suffix "pr${{ github.event.number }}"
```

**MUST**: 削除漏れを週次でチェックする（コストと機密の残存を防ぐ）。

## 8. GitHub Environments

| 環境 | Secrets | 保護 |
|---|---|---|
| `preview` | `CLOUDFLARE_API_TOKEN`, `NEON_API_KEY` | なし |
| `mvp` | 上記 + `DATABASE_URL_DIRECT`(mvp) | ブランチ制限：main |
| `production` | 上記 + 本番用 | 🔒 **Required reviewers**、ブランチ制限：タグ |

## 9. 自動マージの条件

品質ゲートをすべて満たした通常PRは自動マージしてよい。ただし次は**対象外**とし、
別PRへ分離して明示承認を得る。

| 対象外の変更 |
|---|
| 公開DNS・custom domain・production route の変更 |
| 本番シークレットの追加・変更・削除・ローテーション |
| 認証方式・主要な認可モデルの変更 |
| 破壊的マイグレーション・本番データ削除 |
| 費用構造に影響する変更 |
| 外部公開範囲・データ保持期間・監査方式の重大変更 |

**MUST**: 正規手順（`gh pr merge --auto --squash` 等）を用い、保護規則を迂回しない。

## 10. 失敗時の対応

| 失敗 | 対応 |
|---|---|
| lint / typecheck | 修正して再push |
| test | 原因を特定。テストが正しければ実装を直す。テストを消さない |
| dep-audit | 依存を更新。更新できない場合は理由と緩和策を記録し、承認を得る |
| db-migrate | マイグレーションを見直す。ロールバック不能な変更を作らない |
| e2e | 環境差か実装かを切り分ける。フレーキーなら原因を除去する（無効化しない） |
| 本番デプロイ | 直ちにロールバック（[../70-operations/01-deployment-procedure.md](../70-operations/01-deployment-procedure.md)） |

**同一原因の失敗が3回続いた場合**、修正を繰り返さず Issue 化して原因分析へ切り替える。
