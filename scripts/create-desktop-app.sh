#!/bin/bash
# Memorwise — Create Desktop App
# Run: chmod +x scripts/create-desktop-app.sh && ./scripts/create-desktop-app.sh
#
# Creates a clickable app icon that starts Memorwise and opens the browser.
# macOS: Creates a .app bundle in /Applications
# Linux: Creates a .desktop launcher

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PORT=4747
URL="http://local.memorwise.com:$PORT"

# Colors
c_reset='\033[0m'
c_bold='\033[1m'
c_dim='\033[2m'
c_cyan='\033[36m'
c_green='\033[32m'
c_red='\033[31m'

log()  { echo -e "$1"; }
ok()   { log "  ${c_green}✓${c_reset} $1"; }
fail() { log "  ${c_red}✗${c_reset} $1"; }
step() { log "\n  ${c_cyan}>${c_reset} $1"; }

log ""
log "  ${c_bold}Memorwise — Desktop App Creator${c_reset}"
log "  ${c_dim}─────────────────────────────────${c_reset}"

# ─── macOS ────────────────────────────────────
if [[ "$(uname)" == "Darwin" ]]; then
  APP_NAME="Memorwise"
  APP_PATH="/Applications/${APP_NAME}.app"
  ICON_SOURCE="$PROJECT_DIR/public/favicon.png"

  step "Creating macOS app at ${c_bold}${APP_PATH}${c_reset}"

  # Create .app bundle structure
  mkdir -p "$APP_PATH/Contents/MacOS"
  mkdir -p "$APP_PATH/Contents/Resources"

  # Create the launcher script
  cat > "$APP_PATH/Contents/MacOS/Memorwise" << LAUNCHER
#!/bin/bash
PROJECT_DIR="$PROJECT_DIR"
PORT=$PORT
URL="$URL"

cd "\$PROJECT_DIR"

# Check if already running
if curl -s -o /dev/null --connect-timeout 1 "\$URL" 2>/dev/null; then
  open "\$URL"
  exit 0
fi

# Start server in background
npm run dev &>/dev/null &
SERVER_PID=\$!

# Wait for server to be ready (max 30s)
for i in {1..60}; do
  if curl -s -o /dev/null --connect-timeout 1 "http://localhost:\$PORT" 2>/dev/null; then
    open "\$URL"
    wait \$SERVER_PID
    exit 0
  fi
  sleep 0.5
done

# Timeout — open anyway
open "\$URL"
wait \$SERVER_PID
LAUNCHER
  chmod +x "$APP_PATH/Contents/MacOS/Memorwise"

  # Create Info.plist
  cat > "$APP_PATH/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>Memorwise</string>
  <key>CFBundleIdentifier</key>
  <string>com.memorwise.app</string>
  <key>CFBundleName</key>
  <string>Memorwise</string>
  <key>CFBundleDisplayName</key>
  <string>Memorwise</string>
  <key>CFBundleVersion</key>
  <string>1.0.8</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.8</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.15</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

  # Convert PNG to icns if sips is available
  if [[ -f "$ICON_SOURCE" ]] && command -v sips &>/dev/null; then
    ICONSET_DIR=$(mktemp -d)/Memorwise.iconset
    mkdir -p "$ICONSET_DIR"
    for size in 16 32 64 128 256 512; do
      sips -z $size $size "$ICON_SOURCE" --out "$ICONSET_DIR/icon_${size}x${size}.png" &>/dev/null
      double=$((size * 2))
      sips -z $double $double "$ICON_SOURCE" --out "$ICONSET_DIR/icon_${size}x${size}@2x.png" &>/dev/null
    done
    iconutil -c icns -o "$APP_PATH/Contents/Resources/AppIcon.icns" "$ICONSET_DIR" 2>/dev/null || true
    rm -rf "$(dirname "$ICONSET_DIR")"
    ok "App icon created"
  else
    log "  ${c_dim}! Icon skipped (favicon.png not found or sips unavailable)${c_reset}"
  fi

  ok "Created ${c_bold}${APP_PATH}${c_reset}"
  log ""
  log "  ${c_dim}Find it in Launchpad or /Applications.${c_reset}"
  log "  ${c_dim}Drag to your Dock for quick access.${c_reset}"

# ─── Linux ────────────────────────────────────
elif [[ "$(uname)" == "Linux" ]]; then
  DESKTOP_FILE="$HOME/.local/share/applications/memorwise.desktop"
  ICON_SOURCE="$PROJECT_DIR/public/favicon.png"

  step "Creating Linux desktop launcher"

  mkdir -p "$HOME/.local/share/applications"

  # Create launcher script
  LAUNCHER_SCRIPT="$PROJECT_DIR/scripts/memorwise-launcher.sh"
  cat > "$LAUNCHER_SCRIPT" << LAUNCHER
#!/bin/bash
PROJECT_DIR="$PROJECT_DIR"
PORT=$PORT
URL="$URL"

cd "\$PROJECT_DIR"

if curl -s -o /dev/null --connect-timeout 1 "\$URL" 2>/dev/null; then
  xdg-open "\$URL"
  exit 0
fi

npm run dev &>/dev/null &
for i in {1..60}; do
  if curl -s -o /dev/null --connect-timeout 1 "http://localhost:\$PORT" 2>/dev/null; then
    xdg-open "\$URL"
    break
  fi
  sleep 0.5
done
wait
LAUNCHER
  chmod +x "$LAUNCHER_SCRIPT"

  # Create .desktop file
  cat > "$DESKTOP_FILE" << DESKTOP
[Desktop Entry]
Name=Memorwise
Comment=Chat with your documents locally
Exec=$LAUNCHER_SCRIPT
Icon=$ICON_SOURCE
Terminal=false
Type=Application
Categories=Utility;Education;
StartupWMClass=memorwise
DESKTOP

  ok "Created desktop launcher"
  log ""
  log "  ${c_dim}Find Memorwise in your app menu.${c_reset}"

else
  fail "Unsupported platform: $(uname)"
  log "  ${c_dim}This script supports macOS and Linux.${c_reset}"
  log "  ${c_dim}On Windows, create a shortcut to: npx memorwise${c_reset}"
  exit 1
fi

log ""
log "  ${c_green}${c_bold}Done!${c_reset} Click the Memorwise icon to launch."
log ""
