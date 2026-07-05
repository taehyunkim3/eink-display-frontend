#!/bin/bash
# Manage the agent-status-bridge launchd agent (auto-start on login).
#
#   npm run bridge:install     register + start now
#   npm run bridge:uninstall   stop + remove
#   npm run bridge:status      show state and recent log
set -euo pipefail

LABEL="com.eink.agent-bridge"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$(command -v node)"
LOG_FILE="$HOME/Library/Logs/eink-agent-bridge.log"
GUI_DOMAIN="gui/$(id -u)"

case "${1:-}" in
  install)
    mkdir -p "$HOME/Library/LaunchAgents"
    cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$REPO_DIR/bridge/agent-status-bridge.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG_FILE</string>
  <key>StandardErrorPath</key><string>$LOG_FILE</string>
</dict>
</plist>
PLIST
    # Kill any manually-started copy so the port is free for launchd's one.
    pkill -f agent-status-bridge.mjs 2>/dev/null || true
    launchctl bootout "$GUI_DOMAIN" "$PLIST" 2>/dev/null || true
    launchctl bootstrap "$GUI_DOMAIN" "$PLIST"
    echo "Registered: $PLIST"
    echo "Log: $LOG_FILE"
    sleep 1
    launchctl print "$GUI_DOMAIN/$LABEL" | grep -E "state|pid" | head -3 || true
    ;;
  uninstall)
    launchctl bootout "$GUI_DOMAIN" "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Removed: $LABEL"
    ;;
  status)
    if launchctl print "$GUI_DOMAIN/$LABEL" >/dev/null 2>&1; then
      launchctl print "$GUI_DOMAIN/$LABEL" | grep -E "state|pid|last exit" | head -5
    else
      echo "Not registered ($LABEL)"
    fi
    if [ -f "$LOG_FILE" ]; then
      echo "--- last log lines ---"
      tail -5 "$LOG_FILE"
    fi
    ;;
  *)
    echo "Usage: $0 {install|uninstall|status}" >&2
    exit 1
    ;;
esac
