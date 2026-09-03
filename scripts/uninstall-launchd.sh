#!/bin/sh
# Stops and removes the automatic sync schedule installed by install-launchd.sh.
# Does not touch any already-synced data or your LearningSuite account.
set -eu

LABEL="com.docket.sync"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ -f "$PLIST_PATH" ]; then
  launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
  rm -f "$PLIST_PATH"
  echo "Automatic sync stopped and removed."
else
  echo "No automatic sync schedule was installed."
fi
