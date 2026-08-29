repo: Kensan196948G/Civil-Technology-IP-Intelligence-Platform
branch: main
path: apps/web

## Last sync
date: 2026-08-23T11:37:17Z

### Updated in this project
- 現行UI(ダッシュボード・横断検索・現場適用スコア・AIアシスタント)をピクセル再現
- 新WebUIデザイン2案を作成し、採用案B(AI対話型)を4画面に展開 (design-B-copilot.dc.html)

## Screen map
| 画面 | リポジトリ側ファイル |
|---|---|
| 現行UI再現.dc.html (共通シェル) | apps/web/src/app/globals.css, src/components/AppShell.tsx, src/components/Sidebar.tsx, src/lib/nav.ts, src/app/(app)/layout.tsx |
| 現行UI再現.dc.html (ダッシュボード) | apps/web/src/app/(app)/dashboard/page.tsx |
| 現行UI再現.dc.html (横断検索) | apps/web/src/app/(app)/search/page.tsx |
| 現行UI再現.dc.html (現場適用スコア) | apps/web/src/app/(app)/field/[id]/page.tsx, field/page.tsx |
| 現行UI再現.dc.html (AIアシスタント) | apps/web/src/app/(app)/ai-assistant/page.tsx, src/components/InfoPage.tsx |
| design-A-workflow.dc.html / design-B-copilot.dc.html | 上記全部 + docs/README.md (機能・原則の根拠) |
