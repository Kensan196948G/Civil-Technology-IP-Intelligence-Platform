#!/usr/bin/env bash
# CTIIP 外形監視（合成監視）。
#
# Deep Debug 2026-09-10 で判明した監視の欠落への対応:
#   docs/70-operations/02-monitoring-and-alerting.md §1.1 は
#   「ヘルスチェック応答（**外部合成監視**）／3回連続失敗」を監視項目として宣言しているが、
#   CTIIP には監視の実行機構が存在しなかった。その結果、以下が**誰にも検知されずに継続**した:
#     ・本番チェックアウトが 47 コミット取り残されたまま稼働（2026-08-29〜09-10）
#     ・MVP 環境が HTTP 530 / Cloudflare error 1033 で恒久停止
#     ・/api/health が env:'mvp' 固定・time が 2026-09-01T02:45:02.896Z で凍結
#   本スクリプトは上記を検知できるよう、公開URLを外側から叩いて次を確認する:
#     ① HTTP 200 が返ること
#     ② DB 到達性（新実装の /api/health は db フィールドを返す。失敗時は 503 + degraded）
#     ③ 版数ドリフト（/api/health の version が origin/main と一致するか）
#   同ホストの他プロジェクト（adet / codip / civil-twin）に倣い
#   systemd user timer から定期実行する（ctiip-healthcheck.timer）。
#
# 判定結果は journal へ出力し、失敗時は終了コード 1 を返す
# （systemctl --user --failed や journalctl --user -u ctiip-healthcheck で確認できる）。
#
# 注意: 本番サービス（system unit）の再起動はここでは行わない。
#   本スクリプトの目的は「検知」であり、復旧操作は承認された手順
#   （docs/70-operations/01-deployment-procedure.md）で人間が行う。
#   MVP（user unit）のみ、ローカルポートの異常時に再起動する。
set -uo pipefail

REPO="${CTIIP_REPO:-/home/kensan/Projects/Mirai-DX-Project/Civil-Technology-IP-Intelligence-Platform}"
MVP_URL="${CTIIP_MVP_HEALTH_URL:-https://ctiip-mvp.mirai-dx-platform.com/api/health}"
PROD_URL="${CTIIP_PROD_HEALTH_URL:-https://ctip.mirai-dx-platform.com/api/health}"
MVP_LOCAL_URL="http://127.0.0.1:3001/api/health"
STATE_DIR="${CTIIP_HEALTHCHECK_STATE:-$HOME/.local/state/ctiip-healthcheck}"

mkdir -p "$STATE_DIR"
LOG="$STATE_DIR/last-run.log"
: > "$LOG"

failures=0
warnings=0

log()  { printf '%s\n' "$*" | tee -a "$LOG"; }
warn() { printf 'WARN: %s\n' "$*" | tee -a "$LOG" >&2; warnings=$((warnings + 1)); }
bad()  { printf 'FAIL: %s\n' "$*" | tee -a "$LOG" >&2; failures=$((failures + 1)); }

# 期待するコミット（origin/main）。ローカル参照のみ（ネットワーク不要）。
EXPECTED="$(git -C "$REPO" rev-parse origin/main 2>/dev/null || echo '')"
[ -n "$EXPECTED" ] || warn "origin/main を解決できませんでした（版数ドリフト判定をスキップ）: $REPO"

# ── 1. 公開エンドポイントの疎通とヘルス内容 ──────────────────────────────
check_public() {
  local name="$1" url="$2"
  local raw code body
  raw="$(curl -s --max-time 20 -w '\n%{http_code}' "$url" 2>/dev/null)" || raw=$'\n000'
  code="$(printf '%s' "$raw" | tail -n 1)"
  body="$(printf '%s' "$raw" | sed '$d')"

  if [ "$code" != "200" ]; then
    bad "$name: $url が HTTP $code を返しました（200 期待）"
    return
  fi
  log "OK  $name: HTTP 200"

  # DB 到達性（新実装のみ db フィールドを返す。旧実装は判定不能として警告に留める）
  case "$body" in
    *'"db":"ok"'*)  log "OK  $name: db=ok" ;;
    *'"db":"error"'*) bad "$name: db=error（DBに到達できていません）" ;;
    *'"db":'*)      warn "$name: db の状態が ok ではありません: $body" ;;
    *)              warn "$name: レスポンスに db フィールドがありません（旧実装の可能性）: $body" ;;
  esac

  # 版数ドリフト（動作中コミットが origin/main と一致しているか）
  local deployed
  deployed="$(printf '%s' "$body" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p')"
  if [ -z "$deployed" ]; then
    warn "$name: version が未報告です（旧実装。ビルド時に CTIIP_COMMIT_SHA が埋まっていない）"
  elif [ -n "$EXPECTED" ] && [ "$deployed" != "$EXPECTED" ]; then
    warn "$name: 版数ドリフト — 稼働=$deployed / origin/main=$EXPECTED"
  else
    log "OK  $name: version=$deployed（origin/main と一致）"
  fi
}

log "=== CTIIP healthcheck $(date '+%Y-%m-%d %H:%M:%S %Z') ==="
log "expected origin/main: ${EXPECTED:-unknown}"
check_public prod "$PROD_URL"
check_public mvp  "$MVP_URL"

# ── 2. MVP のローカル監視と自動復旧（user unit のため操作可能） ──────────
local_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$MVP_LOCAL_URL" 2>/dev/null || echo 000)"
if [ "$local_code" != "200" ]; then
  if systemctl --user is-active --quiet ctiip-mvp-web.service; then
    warn "MVP ローカル(127.0.0.1:3001) が HTTP $local_code — ctiip-mvp-web.service を再起動します"
    systemctl --user restart ctiip-mvp-web.service || warn "ctiip-mvp-web.service の再起動に失敗しました"
  else
    bad "MVP ローカル(127.0.0.1:3001) が応答せず、ctiip-mvp-web.service も active ではありません"
  fi
else
  log "OK  MVP ローカル: HTTP 200"
fi

# ── 3. 集計 ────────────────────────────────────────────────────────────
log "=== 結果: failures=$failures warnings=$warnings ==="
if [ "$failures" -gt 0 ]; then
  printf '%s failures=%s warnings=%s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$failures" "$warnings" > "$STATE_DIR/last-failure"
  exit 1
fi
: > "$STATE_DIR/last-failure"
exit 0
