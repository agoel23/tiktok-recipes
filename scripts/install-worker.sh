#!/bin/bash
# Installs the worker as a launchd agent that starts at login and restarts on crash.
#
# macOS blocks background (launchd) processes from reading ~/Desktop, so the worker
# code, .env and its virtualenv are copied to ~/.recipe-book. Re-run this after
# changing worker code or worker/.env.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
HOME_DIR="$HOME/.recipe-book"
LABEL="com.recipebook.worker"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/recipe-book.log"

[ -f "$REPO/worker/.env" ] || { echo "worker/.env is missing — copy .env.example and fill it in first."; exit 1; }

mkdir -p "$HOME_DIR/app" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
rsync -a --delete --exclude '__pycache__' --exclude 'tests' "$REPO/worker/" "$HOME_DIR/app/worker/"
rsync -a --delete "$REPO/shared/" "$HOME_DIR/app/shared/"

if [ ! -x "$HOME_DIR/venv/bin/python" ]; then
  python3 -m venv "$HOME_DIR/venv"
fi
"$HOME_DIR/venv/bin/pip" install -q --upgrade pip
"$HOME_DIR/venv/bin/pip" install -q -r "$HOME_DIR/app/worker/requirements.txt"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$HOME_DIR/venv/bin/python</string>
    <string>-m</string>
    <string>worker</string>
  </array>
  <key>WorkingDirectory</key><string>$HOME_DIR/app</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
# bootout is asynchronous; bootstrapping before the old instance is gone fails with "Input/output error".
for _ in $(seq 1 20); do
  launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || break
  sleep 0.5
done
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Worker installed and running. Logs: $LOG"
