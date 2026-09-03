#!/bin/sh
# Installs a macOS launchd user agent that runs `docket sync --source ics`
# automatically on a schedule (default: every hour), so course data stays
# current — new assignments, moved due dates, removed items — without
# anyone opening a terminal or clicking "Sync now". Safe to re-run.
#
# This only ever talks to LearningSuite's unauthenticated ICS feed (see
# docs/ARCHITECTURE.md §1.4) — no browser, no login, nothing that needs a
# human present. See docs/ROADMAP.md "Automating it."

set -eu

INTERVAL_SECONDS="${1:-3600}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$(command -v node)"
LABEL="com.docket.sync"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ -z "$NODE_BIN" ]; then
  echo "Could not find 'node' on PATH. Install Node.js first." >&2
  exit 1
fi

if [ ! -d "$PROJECT_DIR/dist" ]; then
  echo "No dist/ found — run 'npm run build' in $PROJECT_DIR first." >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$PROJECT_DIR/data"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$PROJECT_DIR/dist/src/cli.js</string>
    <string>sync</string>
    <string>--source</string>
    <string>ics</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$PROJECT_DIR</string>
  <key>StartInterval</key>
  <integer>$INTERVAL_SECONDS</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$PROJECT_DIR/data/sync.log</string>
  <key>StandardErrorPath</key>
  <string>$PROJECT_DIR/data/sync.log</string>
</dict>
</plist>
PLIST

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load "$PLIST_PATH"

echo "Installed. Docket will sync automatically every $INTERVAL_SECONDS seconds."
echo "Logs: $PROJECT_DIR/data/sync.log"
echo "To stop: scripts/uninstall-launchd.sh"
