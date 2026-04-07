#!/bin/bash
echo "Cleaning build artifacts..."
rm -rf gateway/dist
rm -rf extensions/*/dist
rm -rf ui/dist
rm -rf packages/*/dist
echo "✅ Clean complete"
