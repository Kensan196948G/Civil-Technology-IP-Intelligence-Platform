# 📐 アーキテクチャ決定記録（ADR）

重要な技術判断を、決定・理由・結果・再評価条件とともに残す。

| ID | 決定 | 状態 |
|---|---|---|
| [ADR-0001](ADR-0001-cloudflare-neon-github.md) | 実行基盤を Cloudflare、DBを Neon、CI/CDを GitHub Actions とする | 採択（DB部分は ADR-0007 で更新） |
| [ADR-0002](ADR-0002-monorepo-typescript.md) | TypeScript モノレポ（pnpm + Turborepo）で構成する | 採択 |
| [ADR-0003](ADR-0003-japanese-search.md) | 日本語検索を pg_trgm + pgvector のハイブリッドで実現する | 採択（再評価条件あり） |
| [ADR-0004](ADR-0004-async-ai-execution.md) | AI処理を非同期（Queues / Workflows）で実行する | 採択 |
| [ADR-0005](ADR-0005-auth-cloudflare-access.md) | 認証を Cloudflare Access に委ね、アプリは認可のみ担う | 採択 |
| [ADR-0006](ADR-0006-provenance-first.md) | Provenance をデータモデルの中核に置く | 採択 |
| [ADR-0007](ADR-0007-local-postgresql.md) | 主DBをローカル PostgreSQL へ移行する（Neon を廃止） | **採択**（2026-08-29 実施済み） |

## 記法

各 ADR は次の節を持つ。

```text
文脈 / 決定 / 理由 / 結果（良い点・悪い点）/ 代替案 / 再評価条件
```
