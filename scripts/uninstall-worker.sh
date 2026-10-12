#!/bin/bash
# Stops the background worker and removes its launchd agent (keeps ~/.recipe-book).
LABEL="com.recipebook.worker"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "Worker stopped and removed."
