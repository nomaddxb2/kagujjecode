#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# KagujjeCode One-Line Installer for Android Termux
# Repository: https://github.com/nomaddxb2/kagujjecode
# Author: Dickson Kagujje (nomaddxb2)
# ==============================================================================

set -euo pipefail

C_RESET='\033[0m'
C_BOLD='\033[1m'
C_CYAN='\033[36m'
C_GREEN='\033[32m'
C_YELLOW='\033[33m'
C_RED='\033[31m'

printf "${C_CYAN}${C_BOLD}"
cat <<'EOF'
 _                                _                _      
| | ____ _  __ _ _   _ (_)  _   _  ___ ___   __| | ___ 
| |/ / _` |/ _` | | | || | (_) / __/ _ \ / _` |/ _ \
|   < (_| | (_| | |_| || |  _ | (_| (_) | (_| |  __/
|_|\_\__,_|\__, |\__,_|/ | (_)\___\___/ \__,_|\___|
           |___/     |__/                          
EOF
printf "${C_RESET}Unrestricted OpenCode Alternative for Android Termux\n\n"

# 1. Architecture & Environment Verification
ARCH="$(uname -m)"
if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "arm64" ]; then
  printf "${C_RED}Error: KagujjeCode is optimized for Android aarch64 (ARM64). Detected: %s${C_RESET}\n" "$ARCH"
  exit 1
fi

PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
HOME="${HOME:-/data/data/com.termux/files/home}"
INSTALL_DIR="$HOME/kagujjecode"
BIN_TARGET="$PREFIX/bin/kagujjecode"

# 2. Package Prerequisites
printf "${C_YELLOW}◇ Step 1/4: Checking Termux packages...${C_RESET}\n"
PKGS=""
command -v curl >/dev/null 2>&1 || PKGS="$PKGS curl"
command -v git >/dev/null 2>&1 || PKGS="$PKGS git"
command -v node >/dev/null 2>&1 || PKGS="$PKGS nodejs-lts"
command -v tar >/dev/null 2>&1 || PKGS="$PKGS tar"
command -v patchelf >/dev/null 2>&1 || PKGS="$PKGS patchelf"
[ -f "$PREFIX/etc/tls/cert.pem" ] || PKGS="$PKGS ca-certificates"
[ -f "$PREFIX/etc/resolv.conf" ] || PKGS="$PKGS resolv-conf"

if [ -n "$PKGS" ]; then
  printf "  Installing dependencies: %s\n" "$PKGS"
  pkg update -y || true
  pkg install -y $PKGS
fi
printf "${C_GREEN}✓ Dependencies ready.${C_RESET}\n\n"

# 3. Clone or Update KagujjeCode
printf "${C_YELLOW}◇ Step 2/4: Deploying KagujjeCode workspace...${C_RESET}\n"
if [ -d "$INSTALL_DIR/.git" ]; then
  printf "  Updating existing checkout at %s...\n" "$INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only origin main || true
elif [ -d "$INSTALL_DIR" ]; then
  printf "  Using local installation directory %s...\n" "$INSTALL_DIR"
else
  printf "  Cloning repository into %s...\n" "$INSTALL_DIR"
  git clone https://github.com/nomaddxb2/kagujjecode.git "$INSTALL_DIR"
fi
printf "${C_GREEN}✓ Repository deployed.${C_RESET}\n\n"

# 4. Wire Global Binary Symlink
printf "${C_YELLOW}◇ Step 3/4: Creating CLI symlink in PATH...${C_RESET}\n"
mkdir -p "$PREFIX/bin"
chmod +x "$INSTALL_DIR/bin/kagujjecode" "$INSTALL_DIR/bin/install-runtime.js"
ln -sf "$INSTALL_DIR/bin/kagujjecode" "$BIN_TARGET"
printf "${C_GREEN}✓ Symlink created: %s -> %s${C_RESET}\n\n" "$BIN_TARGET" "$INSTALL_DIR/bin/kagujjecode"

# 5. Initialize Runtime & Musl Patching
printf "${C_YELLOW}◇ Step 4/4: Initializing runtime & bypass engine...${C_RESET}\n"
"$BIN_TARGET" install
"$BIN_TARGET" plugins sync
"$BIN_TARGET" rotate >/dev/null 2>&1 || true

printf "\n${C_GREEN}${C_BOLD}✓ Installation complete!${C_RESET}\n\n"
printf "Run KagujjeCode right away:\n"
printf "  ${C_CYAN}kagujjecode${C_RESET}            - Launch coding assistant\n"
printf "  ${C_CYAN}kagujjecode status${C_RESET}     - Inspect active identity & bypasses\n"
printf "  ${C_CYAN}kagujjecode rotate${C_RESET}     - Force-rotate fingerprint & wire ID\n"
printf "  ${C_CYAN}kagujjecode help${C_RESET}       - View full documentation & all options\n\n"
