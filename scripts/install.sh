#!/bin/bash
set -euo pipefail
echo "=== CoreBlow Installation Script ==="
echo "Checking Node.js version..."
node_version=$(node -v 2>/dev/null || echo "none")
if [ "$node_version" = "none" ]; then
  echo "❌ Node.js is required. Install from https://nodejs.org"
  exit 1
fi
echo "Node.js: $node_version"
echo "Installing dependencies..."
npm install
echo "Building gateway..."
cd gateway && npm run build
echo "✅ CoreBlow installed successfully!"
echo "Run: npm start"
