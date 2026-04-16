#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Jibri finalize script
# Called by Jibri automatically after every recording ends.
#
# Arguments:
#   $1 = absolute path to the recording directory (e.g. /config/recordings/NEX-ABC123)
#
# What this script does:
#   1. Writes meeting-metadata.json (room, end time, file list)
#   2. Finds the Prosody MUC log for this room and converts it to chat.json
#   3. POSTs a webhook to the Express server so it can update the DB record
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RECORDING_DIR="${1:-}"
if [ -z "$RECORDING_DIR" ]; then
  echo "[finalize] ERROR: no recording directory supplied" >&2
  exit 1
fi

ROOM_ID="$(basename "$RECORDING_DIR")"
ENDED_AT="$(date -Iseconds)"
FINALIZE_SECRET="${FINALIZE_SECRET:-}"
SERVER_URL="${SERVER_URL:-http://host.docker.internal:5000}"
PROSODY_MUC_LOG_ROOT="/prosody-muclogs"
XMPP_MUC_DOMAIN="${XMPP_DOMAIN:-meet.jitsi}"

echo "[finalize] Processing room=$ROOM_ID dir=$RECORDING_DIR"

# ── 1. Gather file list ───────────────────────────────────────────────────────
FILES=()
while IFS= read -r f; do
  FILES+=("$(basename "$f")")
done < <(find "$RECORDING_DIR" -maxdepth 1 -type f \( -name "*.mp4" -o -name "*.ogg" -o -name "*.webm" \) | sort)

FILES_JSON="$(printf '"%s",' "${FILES[@]}" | sed 's/,$//')"

# ── 2. Write metadata.json ────────────────────────────────────────────────────
cat > "$RECORDING_DIR/meeting-metadata.json" << JSON
{
  "roomId": "$ROOM_ID",
  "endedAt": "$ENDED_AT",
  "recordingDirectory": "$RECORDING_DIR",
  "recordingFiles": [$FILES_JSON]
}
JSON
echo "[finalize] Wrote meeting-metadata.json"

# ── 3. Export chat from Prosody MUC log ───────────────────────────────────────
# Prosody stores logs at: /prosody-muclogs/conference.DOMAIN/ROOM/YEAR/MONTH/DAY.html
# We convert the HTML log to a clean JSON array.

ROOM_LC="${ROOM_ID,,}"   # lowercase room name
LOG_DIR="$PROSODY_MUC_LOG_ROOT/conference.${XMPP_MUC_DOMAIN}/${ROOM_LC}"
CHAT_JSON="$RECORDING_DIR/chat.json"

if [ -d "$LOG_DIR" ]; then
  echo "[finalize] Exporting chat from $LOG_DIR"

  # Gather all log files sorted by date
  ALL_LINES="[]"
  FIRST=1
  {
    echo "["
    while IFS= read -r html_file; do
      # Each line in Prosody HTML log looks like:
      # <p><span class="time">HH:MM:SS</span> <span class="nick">Name</span><span class="body"> message</span></p>
      grep -oP '(?<=<span class="time">)[^<]+|(?<=<span class="nick">)[^<]+|(?<=<span class="body">)[^<]+' "$html_file" \
        | paste - - - \
        | while IFS=$'\t' read -r ts nick body; do
            ts_clean="${ts// /}"
            nick_clean="$(echo "$nick" | sed 's/[<>]//g; s/&amp;/\&/g; s/&lt;/</g; s/&gt;/>/g; s/&quot;/"/g')"
            body_clean="$(echo "$body" | sed 's/[<>]//g; s/&amp;/\&/g; s/&lt;/</g; s/&gt;/>/g; s/&quot;/"/g; s/\\/\\\\/g; s/"/\\"/g')"
            if [ -n "$body_clean" ] && [ "${body_clean:0:1}" != "/" ]; then
              [ "$FIRST" = "0" ] && echo ","
              printf '  {"time":"%s","from":"%s","message":"%s"}' "$ts_clean" "$nick_clean" "$body_clean"
              FIRST=0
            fi
          done
    done < <(find "$LOG_DIR" -name "*.html" | sort)
    echo ""
    echo "]"
  } > "$CHAT_JSON"

  echo "[finalize] Wrote chat.json ($(wc -l < "$CHAT_JSON") lines)"
else
  echo "[finalize] No Prosody MUC log found at $LOG_DIR — writing empty chat.json"
  echo "[]" > "$CHAT_JSON"
fi

# ── 4. Notify Express server via webhook ──────────────────────────────────────
if [ -n "$FINALIZE_SECRET" ]; then
  echo "[finalize] Calling webhook $SERVER_URL/api/meetings/recording/finalize"
  HTTP_STATUS=$(curl -s -o /tmp/finalize_resp.txt -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "X-Finalize-Secret: $FINALIZE_SECRET" \
    --connect-timeout 10 --max-time 30 \
    -d "{\"roomId\":\"$ROOM_ID\",\"recordingDir\":\"$RECORDING_DIR\",\"endedAt\":\"$ENDED_AT\"}" \
    "$SERVER_URL/api/meetings/recording/finalize" || echo "000")

  if [ "$HTTP_STATUS" = "200" ]; then
    echo "[finalize] Webhook acknowledged (200)"
  else
    echo "[finalize] Webhook returned $HTTP_STATUS — $(cat /tmp/finalize_resp.txt 2>/dev/null)"
  fi
else
  echo "[finalize] FINALIZE_SECRET not set — skipping webhook"
fi

echo "[finalize] Done for room=$ROOM_ID"
exit 0
