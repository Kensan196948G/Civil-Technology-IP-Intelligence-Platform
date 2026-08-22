# 🌐 DNS とドメイン

> 🔒 **公開DNSの変更は承認事項**。本書は手順を定義するのみで、**変更は実行していない**。

## 1. ドメイン

| 項目 | 値 | 用途 | 状態 |
|---|---|---|---|
| ルートドメイン | `mirai-dx-platform.com` | — | 取得済み |
| MVP サブドメイン | `ctiip-mvp` | **MVP・プロトタイプ環境（ダミーデータ中心）** | **新規取得（未作成）** |
| 本番サブドメイン | `ctiip` | **本番環境（実データ）** | **新規取得（未作成）** |

```text
https://ctiip-mvp.mirai-dx-platform.com   MVP・プロトタイプ（ダミーデータ多用）
https://ctiip.mirai-dx-platform.com       本番（ダミー少なめ → 最終的にゼロ、本番データ取り込み）
```

`ctiip` = **C**ivil **T**echnology & **I**P **I**ntelligence **P**latform

## 2. レコード設計

| 名前 | 種別 | 向き先 | Proxy | 用途 |
|---|---|---|---|---|
| `ctiip-mvp` | Workers Custom Domain | `ctiip-web-mvp` Worker | ○（オレンジ雲） | MVP |
| `ctiip` | Workers Custom Domain | `ctiip-web-prod` Worker | ○（オレンジ雲） | 本番 |

Cloudflare Workers にカスタムドメインを割り当てる場合、
Workers の **Custom Domain** 機能でレコードが自動作成される。手動 CNAME より推奨。

⚠️ **要決定** — Custom Domain 方式か Route 方式か。Phase 1 で確定する。

## 3. 前提確認

作業前に次を確認する。

| # | 確認項目 | 確認方法 |
|---|---|---|
| 1 | `mirai-dx-platform.com` が Cloudflare でDNS管理されている | Cloudflare ダッシュボードのゾーン一覧 |
| 2 | ネームサーバが Cloudflare を向いている | `dig NS mirai-dx-platform.com` |
| 3 | 既存の `ctiip` / `ctiip-mvp` レコードが存在しない | `dig ctiip.mirai-dx-platform.com` ほか |
| 4 | 同ドメインの他システムに影響しない | 既存レコードの棚卸し |
| 5 | 作業権限がある | Cloudflare のロール確認 |

## 4. 手順（🔒 承認後に実行）

```text
【MVP 環境】
1. ctiip-web-mvp Worker をデプロイ
2. Workers の Custom Domain に ctiip-mvp.mirai-dx-platform.com を追加
3. 証明書の発行完了を待つ
4. Zero Trust Access のアプリケーションを ctiip-mvp.* に対して作成（SSO + MFA）
5. 疎通確認（HTTPS、認証、リダイレクト）
6. 「MVP環境 — サンプルデータ」バナーが表示されることを確認

【本番環境】
7. 🔒 承認を得る
8. ctiip-web-prod Worker をデプロイ
9. Workers の Custom Domain に ctiip.mirai-dx-platform.com を追加
10. 証明書の発行完了を待つ
11. Zero Trust Access のアプリケーションを ctiip.* に対して作成（SSO + MFA）
12. スモークテスト（[../70-operations/01-deployment-procedure.md](../70-operations/01-deployment-procedure.md)）
```

**MUST**: MVP と本番で **別々の Access アプリケーション**を作る。ポリシーを共有しない。
MVP は閲覧者の範囲が広くなりやすいため、本番のポリシーを流用すると権限設計が崩れる。

## 5. 検証コマンド

```bash
for HOST in ctiip-mvp.mirai-dx-platform.com ctiip.mirai-dx-platform.com; do
  echo "== $HOST =="
  # 名前解決
  dig +short "$HOST"
  # 証明書
  openssl s_client -connect "$HOST:443" -servername "$HOST" < /dev/null 2>/dev/null \
    | openssl x509 -noout -dates -subject
  # 認証が効いていること（未認証で 302 または 403）
  curl -sI "https://$HOST/" | head -n 1
  # ヘルスチェック（Access 除外パス）
  curl -s "https://$HOST/healthz"
done
```

## 6. 切り戻し

| 状況 | 手順 |
|---|---|
| 公開後に重大な問題 | Custom Domain を一時的に外す、または Worker を前バージョンへロールバック |
| 証明書が発行されない | レコードと Proxy 設定を確認。DNS 伝播を待つ |
| 認証が効いていない | ポリシーの適用範囲（パス・ドメイン）を確認。**認証が効かない状態で公開を継続しない** |
| MVP のデータが本番と混在 | 直ちに接続先DBの設定を確認。誤接続なら即停止 |

**MUST**: 認証が機能していないことが判明した場合、直ちに Custom Domain を外して公開を止める。

**MUST**: MVP 環境が本番DB（`main` ブランチ）を参照していないことを、公開前に必ず確認する。
接続先の取り違えは、ダミー環境から実データが見える最悪の事故につながる。

## 7. 関連ドメインとの整理

| システム | サブドメイン | 状態 |
|---|---|---|
| CTIIP 本番 | `ctiip` | 新規 |
| CTIIP MVP | `ctiip-mvp` | 新規 |
| Construction-LegalOps-DX | ⚠️ 要確認 | 別途 |
| その他 Mirai-DX 系 | ⚠️ 要確認 | 別途 |

⚠️ **要決定** — ルートドメイン配下のサブドメイン命名規則。他システムとの整合を Phase 0 で確認する。
`{システム略称}` を本番、`{システム略称}-mvp` を MVP とする本方式を全社標準とするか確認すること。
