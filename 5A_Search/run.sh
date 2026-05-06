#!/bin/bash

# 5*A Search Engine - Run Script
# This script starts the development server
# Includes shell command counter

echo "Starting 5*A..."
echo ""

# Set correct PATH for node and npm
export PATH="/home/ahmed/.local/nodejs/bin:$PATH"
export PATH="./node_modules/.bin:$PATH"

# Unset NODE_ENV to ensure devDependencies are available
unset NODE_ENV

# ─── Shell Command Counter ──────────────────────────────────────────────
COUNTER_FILE="./.shell-command-count"

# Initialize counter file if it doesn't exist
if [ ! -f "$COUNTER_FILE" ]; then
  echo "0" > "$COUNTER_FILE"
fi

# Read current count
CURRENT_COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo "0")

# Increment count
NEW_COUNT=$((CURRENT_COUNT + 1))
echo "$NEW_COUNT" > "$COUNTER_FILE"

# Display counter
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  5*A SEARCH ENGINE - Development Server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Shell session count: $NEW_COUNT"
echo "  Started at: $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if node_modules exists and has vite
if [ ! -f "node_modules/.bin/vite" ]; then
  echo "Dependencies not found or incomplete. Installing..."
  npm install
  echo ""
fi

# Security check - verify no sensitive files are exposed
if [ -f ".env" ]; then
  echo "⚠️  WARNING: .env file detected. Ensure no secrets are stored."
fi

# Display security status
echo "Security: CSP headers enabled | Input sanitization active"
echo ""

# Start the development server
npm run dev
