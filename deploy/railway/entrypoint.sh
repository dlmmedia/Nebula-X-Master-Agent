#!/bin/bash
set -e

# ============================================================================
# Nebula X — Railway Entrypoint
# Sets up persistent volume directories and starts the web server
# ============================================================================

echo "============================================"
echo "  Nebula X — AI Coding Agent"
echo "  Powered by Gemini Orchestration"
echo "============================================"

# Ensure persistent volume directories exist
mkdir -p "${XDG_DATA_HOME:-/data/.local/share}/opencode"
mkdir -p "${XDG_DATA_HOME:-/data/.local/share}/opencode/bin"
mkdir -p "${XDG_DATA_HOME:-/data/.local/share}/opencode/log"
mkdir -p "${XDG_CONFIG_HOME:-/data/.config}/opencode"
mkdir -p "${XDG_STATE_HOME:-/data/.local/state}/opencode"
mkdir -p "${XDG_CACHE_HOME:-/data/.cache}/opencode"
mkdir -p "${NEBULA_WORKSPACE:-/data/workspace}"

# Configure git for the container (needed for AI coding operations)
if [ -z "$(git config --global user.email 2>/dev/null)" ]; then
  git config --global user.email "nebulax@dlmworld.com"
  git config --global user.name "Nebula X"
  echo "[git] Default git identity configured"
fi

# Report status
echo ""
echo "  Volume:     /data"
echo "  Workspace:  ${NEBULA_WORKSPACE:-/data/workspace}"
echo "  Port:       ${PORT:-4096}"
echo "  Database:   ${XDG_DATA_HOME:-/data/.local/share}/opencode/opencode.db"
echo ""

# Warn if no server password is set
if [ -z "${OPENCODE_SERVER_PASSWORD}" ]; then
  echo "  WARNING: OPENCODE_SERVER_PASSWORD is not set!"
  echo "  The web interface will be accessible without authentication."
  echo "  Set this environment variable in Railway for security."
  echo ""
fi

# Change to workspace directory
cd "${NEBULA_WORKSPACE:-/data/workspace}"

# Start Nebula X web server
# --hostname 0.0.0.0: Required for Railway (must listen on all interfaces)
# --port $PORT: Railway injects the PORT env var
exec nebula-x web --hostname 0.0.0.0 --port "${PORT:-4096}"
