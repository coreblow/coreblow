#!/usr/bin/env bash
# ============================================================
# CoreBlow Rebrand Verification Script
# Run: bash scripts/rebrand-verify.sh
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

PASS=0
FAIL=0
WARN=0

pass()  { ((PASS++)); echo -e "  ${GREEN}✅ PASS${NC}  $1"; }
fail()  { ((FAIL++)); echo -e "  ${RED}❌ FAIL${NC}  $1"; }
warn()  { ((WARN++)); echo -e "  ${YELLOW}⚠️  WARN${NC}  $1"; }
header(){ echo -e "\n${CYAN}${BOLD}━━━ $1 ━━━${NC}"; }

# Count occurrences in a file (macOS-safe)
count_in_file() {
  local pattern="$1" file="$2"
  grep -c "$pattern" "$file" 2>/dev/null || echo "0"
}

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$(dirname "$0")/..")"

# ============================================================
header "1. Legacy Name Audit (source code)"
# ============================================================

echo -e "  Scanning for legacy identifiers in src/, extensions/, packages/, apps/, ui/ ..."

LEGACY_PATTERNS='clawdbot\|clawdis\|moltbot\|moldbot\|clawdhub\|ClawdbotConfig'
LEGACY_HITS=$(grep -rn "$LEGACY_PATTERNS" \
  src/ extensions/ packages/ apps/ ui/ \
  --include='*.ts' --include='*.swift' --include='*.css' --include='*.html' \
  2>/dev/null \
  | grep -v node_modules | grep -v '/dist/' | grep -v '\.d\.ts' \
  | grep -v '\.test\.' | grep -v '/Tests/' \
  || true)

if [ -z "$LEGACY_HITS" ]; then
  pass "No legacy names (clawdbot/moltbot/moldbot/clawdis/clawdhub/ClawdbotConfig) in production code"
else
  fail "Legacy names found in production code:"
  echo "$LEGACY_HITS" | head -20
fi

# Check test files too (informational)
LEGACY_TEST_HITS=$(grep -rn "$LEGACY_PATTERNS" \
  src/ extensions/ packages/ apps/ ui/ \
  --include='*.test.ts' \
  2>/dev/null \
  | grep -v node_modules | grep -v '/dist/' \
  || true)

if [ -z "$LEGACY_TEST_HITS" ]; then
  pass "No legacy names in test files either"
else
  warn "Legacy names still in test files (verify they are rejection tests):"
  echo "$LEGACY_TEST_HITS" | head -10
fi

# Check for "clawd" specifically (browser driver)
CLAWD_PROD=$(grep -rn '"clawd"' \
  src/ extensions/ packages/ apps/ ui/ \
  --include='*.ts' --include='*.swift' \
  2>/dev/null \
  | grep -v node_modules | grep -v '/dist/' | grep -v '\.d\.ts' \
  | grep -v '\.test\.' | grep -v '/Tests/' \
  || true)

if [ -z "$CLAWD_PROD" ]; then
  pass "No 'clawd' browser driver in production code"
else
  fail "'clawd' still in production code:"
  echo "$CLAWD_PROD" | head -10
fi

# ============================================================
header "2. Lint & Format Check (pnpm check)"
# ============================================================

echo -e "  Running pnpm check ..."
CHECK_OUTPUT=$(pnpm check 2>&1)
if echo "$CHECK_OUTPUT" | grep -q "0 errors"; then
  LINT_WARNINGS=$(echo "$CHECK_OUTPUT" | grep -o '[0-9]* warnings' | head -1 || echo "unknown")
  pass "pnpm check passed ($LINT_WARNINGS)"
else
  fail "pnpm check has errors"
  echo "$CHECK_OUTPUT" | tail -10
fi

# ============================================================
header "3. Build (pnpm build)"
# ============================================================

echo -e "  Running pnpm build ..."
BUILD_OUTPUT=$(pnpm build 2>&1)
if echo "$BUILD_OUTPUT" | grep -q "built in"; then
  pass "pnpm build succeeded"
else
  fail "pnpm build failed"
  echo "$BUILD_OUTPUT" | tail -20
fi

# ============================================================
header "4. Core Tests (scoped - rebrand-affected modules)"
# ============================================================

echo -e "  Running scoped tests for rebrand-affected files ..."

SCOPED_TESTS=(
  "src/config/paths.test.ts"
  "src/daemon/constants.test.ts"
  "src/agents/sandbox/docker-backend.test.ts"
  "src/agents/skills-hub.test.ts"
  "src/config/schema.help.quality.test.ts"
  "extensions/tlon/src/settings.test.ts"
)

EXISTING_TESTS=()
for t in "${SCOPED_TESTS[@]}"; do
  if [ -f "$t" ]; then
    EXISTING_TESTS+=("$t")
  else
    warn "Test file not found: $t"
  fi
done

if [ ${#EXISTING_TESTS[@]} -gt 0 ]; then
  TEST_OUTPUT=$(pnpm test -- "${EXISTING_TESTS[@]}" 2>&1)
  if echo "$TEST_OUTPUT" | grep -q "failedTestFiles=0"; then
    PASSED_COUNT=$(echo "$TEST_OUTPUT" | grep -o '[0-9]* passed' | tail -1 || echo "?")
    pass "Scoped tests passed ($PASSED_COUNT)"
  else
    fail "Scoped tests have failures"
    echo "$TEST_OUTPUT" | grep -E 'FAIL|Error|❌' | head -10
  fi
fi

# ============================================================
header "5. Full Test Suite (pnpm test)"
# ============================================================

echo -e "  Running full test suite (this may take a while) ..."
FULL_TEST_OUTPUT=$(pnpm test 2>&1)
if echo "$FULL_TEST_OUTPUT" | grep -q "failedTestFiles=0"; then
  pass "Full test suite passed"
else
  FAILED_FILES=$(echo "$FULL_TEST_OUTPUT" | grep -c "FAIL" || true)
  fail "Full test suite has failures ($FAILED_FILES test files)"
  echo "$FULL_TEST_OUTPUT" | grep "FAIL" | head -10
fi

# ============================================================
header "6. Config Schema Consistency"
# ============================================================

echo -e "  Checking JSON schema for legacy driver values ..."

if grep -q '"clawd"' src/config/schema.base.generated.ts 2>/dev/null; then
  fail "'clawd' still present in schema.base.generated.ts"
else
  pass "No 'clawd' in generated JSON schema"
fi

if grep -q '"clawd"' src/config/zod-schema.ts 2>/dev/null; then
  fail "'clawd' still present in zod-schema.ts"
else
  pass "No 'clawd' in zod-schema.ts"
fi

if grep -q '"clawd"' src/config/types.browser.ts 2>/dev/null; then
  fail "'clawd' still present in types.browser.ts"
else
  pass "No 'clawd' in types.browser.ts"
fi

# ============================================================
header "7. SDK Surface Check"
# ============================================================

echo -e "  Checking SDK re-exports for ClawdbotConfig ..."
SDK_FILES=(
  "src/plugin-sdk/index.ts"
  "src/plugin-sdk/core.ts"
  "src/plugin-sdk/setup.ts"
  "src/plugin-sdk/feishu.ts"
  "src/plugin-sdk/config-runtime.ts"
  "src/config/types.ts"
)

SDK_CLEAN=true
for f in "${SDK_FILES[@]}"; do
  if [ -f "$f" ] && grep -q "ClawdbotConfig" "$f" 2>/dev/null; then
    fail "ClawdbotConfig still in $f"
    SDK_CLEAN=false
  fi
done
if $SDK_CLEAN; then
  pass "No ClawdbotConfig in any SDK entry point"
fi

# ============================================================
header "8. macOS / iOS Native Code Check"
# ============================================================

echo -e "  Checking Swift files for legacy identifiers ..."
SWIFT_LEGACY=$(grep -rn 'moltbot\|clawdbot\|clawdis\|moldbot' \
  apps/ --include='*.swift' 2>/dev/null \
  | grep -v '\.build/' | grep -v 'DerivedData' \
  || true)

if [ -z "$SWIFT_LEGACY" ]; then
  pass "No legacy identifiers in Swift source files"
else
  fail "Legacy identifiers found in Swift code:"
  echo "$SWIFT_LEGACY" | head -10
fi

# ============================================================
header "9. Git Diff Sanity Check"
# ============================================================

STAGED=$(git diff --cached --stat 2>/dev/null | tail -1 || echo "none")
UNSTAGED=$(git diff --stat 2>/dev/null | tail -1 || echo "none")
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')

echo -e "  Staged:    ${STAGED:-none}"
echo -e "  Unstaged:  ${UNSTAGED:-none}"
echo -e "  Untracked: $UNTRACKED files"

if git diff --check 2>/dev/null; then
  pass "git diff --check passed (no whitespace errors)"
else
  warn "git diff --check has whitespace issues"
fi

# ============================================================
header "RESULTS"
# ============================================================

echo ""
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
echo -e "  ${YELLOW}Warnings: $WARN${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}🎉 ALL CHECKS PASSED — CoreBlow rebrand is clean and GA-ready!${NC}"
  exit 0
else
  echo -e "  ${RED}${BOLD}⚠️  $FAIL CHECK(S) FAILED — review the errors above.${NC}"
  exit 1
fi
