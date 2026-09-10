#!/usr/bin/env bash
#
# systemd ユニットの失敗を機械可読なマーカーとして残す。
#
# systemd の `OnFailure=` から呼ばれる。失敗した側のユニット名を第1引数で受け取る。
#
#   [Unit]
#   OnFailure=ctiip-unit-failed@%n.service
#
#   # ctiip-unit-failed@.service
#   [Service]
#   Type=oneshot
#   ExecStart=<repo>/scripts/ops/record-unit-failure.sh %i
#
# ■ なぜマーカーを残すのか
#
# `systemctl --user list-units --state=failed` の failed 状態は**次の成功で消える**。
# 日次バックアップや5分ごとのヘルスチェックのような oneshot が
# 「失敗 → 次回成功」を繰り返していると、状態だけを見ている監視には**常に正常に見える**。
# 発生そのものを残さないと取りこぼす。
#
# ■ なぜ外部通知しないのか
#
# 通知先（メール / Webhook / Slack）の追加は宛先の選択を伴う人間の判断であり、
# 本プロジェクトでは承認事項である。ここでは**ローカルに痕跡を残すだけ**に留め、
# 拾い上げは人間（または将来の ops-health ジョブ）が行う。
#
#   参考: 本ホストの汎用アラートツール
#     ~/Projects/Mirai-DX-Project/Civil-Weather-Water-Decision/deploy/scripts/ops-alert.sh
#   は Slack/Teams Webhook に対応しているが、本ホストでは
#   `~/.config/cwwd/ops-alert.env` の SLACK_WEBHOOK_URL / TEAMS_WEBHOOK_URL が
#   **未設定**のため現状は journald 出力のみとなる。
#   Webhook を設定すれば、本スクリプトから ops-alert.sh を呼ぶ形に拡張できる
#   （設定は人間の判断・要承認）。
#
set -euo pipefail
umask 077

MARKER_DIR="${CTIIP_UNIT_FAILURE_DIR:-$HOME/.local/state/ctiip/failed-units}"
unit="${1:-unknown.service}"

# ユニット名をファイル名に使うため、パス区切りになりうる文字を落とす。
safe_unit="$(printf '%s' "$unit" | tr -c 'A-Za-z0-9._@-' '_')"

mkdir -p "$MARKER_DIR"
{
  echo "unit=$unit"
  echo "failedAt=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "result=$(systemctl --user show "$unit" -p Result --value 2>/dev/null || echo unknown)"
  echo "exitStatus=$(systemctl --user show "$unit" -p ExecMainStatus --value 2>/dev/null || echo unknown)"
} > "$MARKER_DIR/$safe_unit"

# journal にも残す。マーカーを消したあとでも経緯を追えるようにする。
echo "[unit-failure] $unit failed; marker written to $MARKER_DIR/$safe_unit"
