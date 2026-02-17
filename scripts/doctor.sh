#!/usr/bin/env bash
# scripts/doctor.sh — One-click environment & startup prerequisite check
# Usage: bash scripts/doctor.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✔${NC} $1"; }
fail() { echo -e "  ${RED}✘${NC} $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }

ERRORS=0

echo ""
echo "========================================="
echo "  KeepInMind — Doctor (Environment Check)"
echo "========================================="
echo ""

# --- Node.js ---
echo "[1/7] Node.js"
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v\([0-9]*\).*/\1/')
  if [ "$NODE_MAJOR" -ge 18 ]; then
    pass "node $NODE_VER"
  else
    fail "node $NODE_VER (need >= 18)"
  fi
else
  fail "node not found"
fi

# --- npm ---
echo "[2/7] npm"
if command -v npm &>/dev/null; then
  pass "npm $(npm -v)"
else
  fail "npm not found"
fi

# --- node_modules ---
echo "[3/7] node_modules"
if [ -d "node_modules" ]; then
  pass "node_modules exists"
else
  fail "node_modules missing — run: npm install"
fi

# --- .env ---
echo "[4/7] .env"
if [ -f ".env" ]; then
  if grep -q "OPENAI_API_KEY" .env; then
    pass ".env exists with OPENAI_API_KEY"
  else
    warn ".env exists but OPENAI_API_KEY not found (AI features will fail)"
  fi
else
  fail ".env missing — copy .env.example or create with OPENAI_API_KEY=sk-..."
fi

# --- Electron TypeScript build ---
echo "[5/7] Electron build (tsc)"
if npx tsc --project tsconfig.electron.json --noEmit 2>/dev/null; then
  pass "Electron TypeScript compiles cleanly"
else
  fail "Electron TypeScript has errors — run: npx tsc --project tsconfig.electron.json"
fi

# --- Vite build ---
echo "[6/7] Vite build"
if npx vite build 2>/dev/null 1>/dev/null; then
  pass "Vite build succeeds"
else
  fail "Vite build failed — run: npx vite build"
fi

# --- Tests ---
echo "[7/7] Tests"
if npm test 2>/dev/null 1>/dev/null; then
  pass "All tests pass"
else
  fail "Some tests failed — run: npm test"
fi

echo ""
echo "========================================="
if [ "$ERRORS" -eq 0 ]; then
  echo -e "  ${GREEN}All checks passed!${NC}"
  echo ""
  echo "  Start dev:  npm run dev"
  echo "  Prod test:  npx tsc --project tsconfig.electron.json && npx vite build && npx electron dist-electron/main.js"
else
  echo -e "  ${RED}$ERRORS check(s) failed.${NC} Fix the issues above."
fi
echo "========================================="
echo ""
