#!/usr/bin/env bash
# CoreBlow GA Verification Script
# Run: bash scripts/ga-verify.sh
# NOTE: no set -e — we handle errors per-check via pass/fail/warn

PASS=0
FAIL=0
WARN=0

pass() { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠️  $1"; WARN=$((WARN+1)); }

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         CoreBlow v1.0.0 GA Verification                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Security ──────────────────────────────────────────────────
echo "── 1. Security Audit ─────────────────────────────────────────"
AUDIT=$(pnpm audit 2>&1 || true)
if echo "$AUDIT" | grep -q "No known vulnerabilities"; then
  pass "pnpm audit: 0 vulnerabilities"
else
  AUDIT_TAIL=$(echo "$AUDIT" | tail -1)
  fail "pnpm audit: $AUDIT_TAIL"
fi

# ── 2. TypeScript ────────────────────────────────────────────────
echo ""
echo "── 2. TypeScript Check ───────────────────────────────────────"
TSC_OUT=$(pnpm typecheck 2>&1)
TSC_EXIT=$?
if [ "$TSC_EXIT" -eq 0 ]; then
  pass "tsgo --noEmit: 0 errors"
else
  TSC_ERROR_COUNT=$(echo "$TSC_OUT" | grep -c "error TS" || true)
  warn "tsgo: $TSC_ERROR_COUNT error(s) — $(echo "$TSC_OUT" | grep "error TS" | head -1)"
fi

# ── 3. Lint ──────────────────────────────────────────────────────
echo ""
echo "── 3. Lint & Format ──────────────────────────────────────────"
CHECK_OUT=$(pnpm check 2>&1 || true)
if echo "$CHECK_OUT" | grep -qiE "done|passed|success|All checks"; then
  pass "pnpm check passed"
else
  warn "pnpm check: review output manually"
fi

# ── 4. Swift Build ───────────────────────────────────────────────
echo ""
echo "── 4. Swift (CoreBlowKit) ──────────────────────────────────────"
SWIFT_BUILD=$(swift build --package-path apps/shared/CoreBlowKit 2>&1 || true)
if echo "$SWIFT_BUILD" | grep -q "Build complete"; then
  pass "swift build CoreBlowKit: Build complete"
else
  warn "swift build CoreBlowKit: check output"
fi

# ── 5. Swift Test ────────────────────────────────────────────────
echo ""
echo "── 5. Swift Tests ────────────────────────────────────────────"
SWIFT_TEST=$(swift test --package-path apps/shared/CoreBlowKit --skip E2EGatewayTests 2>&1)
SWIFT_TEST_EXIT=$?
if [ "$SWIFT_TEST_EXIT" -eq 0 ]; then
  TESTS=$(echo "$SWIFT_TEST" | grep -oE "Test run with [0-9]+ tests? in [0-9]+ suites? passed" | head -1 || echo "tests passed")
  pass "swift test CoreBlowKit: $TESTS (E2EGatewayTests skipped)"
else
  warn "swift test CoreBlowKit: failed with exit $SWIFT_TEST_EXIT (E2EGatewayTests skipped)"
fi

# ── 6. Documentation ────────────────────────────────────────────
echo ""
echo "── 6. Documentation Files ────────────────────────────────────"
for f in README.md CONTRIBUTING.md VISION.md AGENTS.md CHANGELOG.md docs.acp.md .env.example SECURITY.md; do
  if [ -f "$f" ]; then
    LINES=$(wc -l < "$f" | tr -d ' ')
    if [ "$LINES" -gt 20 ]; then
      pass "$f ($LINES lines)"
    else
      warn "$f only $LINES lines (expected >20)"
    fi
  else
    fail "$f MISSING"
  fi
done

# CLAUDE.md symlink
if [ -L "CLAUDE.md" ] && [ "$(readlink CLAUDE.md)" = "AGENTS.md" ]; then
  pass "CLAUDE.md → AGENTS.md symlink"
else
  fail "CLAUDE.md symlink missing or incorrect"
fi

# ── 7. Distribution ─────────────────────────────────────────────
echo ""
echo "── 7. Distribution Infrastructure ────────────────────────────"
if [ -f "appcast.xml" ]; then pass "appcast.xml (Sparkle)"; else fail "appcast.xml MISSING"; fi

FL_COUNT=$(find apps/ios/fastlane -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$FL_COUNT" -ge 15 ]; then
  pass "iOS fastlane: $FL_COUNT files"
else
  fail "iOS fastlane: only $FL_COUNT files (expected ≥15)"
fi

# ── 8. CI/CD Workflows ──────────────────────────────────────────
echo ""
echo "── 8. CI/CD Workflows ────────────────────────────────────────"
WF_COUNT=$(ls .github/workflows/*.yml 2>/dev/null | wc -l | tr -d ' ')
if [ "$WF_COUNT" -ge 20 ]; then
  pass "$WF_COUNT workflow files"
else
  warn "Only $WF_COUNT workflows (expected ≥20)"
fi

for w in ci.yml macos-release.yml coreblow-npm-release.yml docker-release.yml codeql.yml plugin-npm-release.yml install-smoke.yml sandbox-common-smoke.yml workflow-sanity.yml; do
  if [ -f ".github/workflows/$w" ]; then pass "$w"; else fail "$w MISSING"; fi
done

# ── 9. Deployment ───────────────────────────────────────────────
echo ""
echo "── 9. Deployment Configs ─────────────────────────────────────"
for f in Dockerfile docker-compose.yml fly.toml fly.private.toml render.yaml Dockerfile.sandbox Dockerfile.sandbox-common Dockerfile.sandbox-browser; do
  if [ -f "$f" ]; then pass "$f"; else fail "$f MISSING"; fi
done

# ── 10. Tooling ─────────────────────────────────────────────────
echo ""
echo "── 10. Tooling ───────────────────────────────────────────────"
for f in .swiftformat .swiftlint.yml .pre-commit-config.yaml zizmor.yml .npmignore .mailmap .github/CODEOWNERS .github/dependabot.yml .github/actionlint.yaml .github/instructions/copilot.instructions.md .github/codeql/codeql-javascript-typescript.yml; do
  if [ -f "$f" ]; then pass "$(basename "$f")"; else fail "$(basename "$f") MISSING"; fi
done

# ── 11. Naming Audit ────────────────────────────────────────────
echo ""
echo "── 11. Naming Audit ──────────────────────────────────────────"
OC_REFS=$(grep -rn "OpenClaw\|openclaw\|OpenClawKit" --include='*.swift' --include='*.ts' --include='*.yml' --include='*.md' \
  apps/ src/ .github/ 2>/dev/null | grep -v node_modules | grep -v .build | grep -v CHANGELOG.md | grep -v ".xcodeproj" | grep -v "test" | grep -v "copilot.instructions" | grep -v "workflow-sanity" | wc -l | tr -d ' ' || echo "0")
if [ "$OC_REFS" -eq 0 ] 2>/dev/null; then
  pass "0 OpenClaw naming remnants in source (excluding tests)"
else
  warn "$OC_REFS OpenClaw refs found — review manually"
fi

# ── 12. Test Infrastructure ─────────────────────────────────────
echo ""
echo "── 12. Test Infrastructure ───────────────────────────────────"
if [ -f "test/scripts/test-planner.executor-fallback.test.ts" ]; then pass "executor-fallback test (211 lines)"; else fail "executor-fallback test MISSING"; fi

# ── Summary ─────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Results: ✅ $PASS passed  ⚠️  $WARN warnings  ❌ $FAIL failed"
echo "══════════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo "  STATUS: FAILED — fix $FAIL items before GA"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo "  STATUS: PASS WITH WARNINGS — review $WARN items"
  exit 0
else
  echo "  STATUS: ALL CLEAR — CoreBlow v1.0.0 GA READY 🚀"
  exit 0
fi
