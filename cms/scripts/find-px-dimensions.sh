#!/bin/bash

# Find all px dimension usage in the app
# Excludes: node_modules, .next, vendor directories

echo "=== Finding all px dimensions in the app ==="
echo ""

# Define directories to exclude
EXCLUDE_DIRS=(
  "node_modules"
  ".next"
  "vendor"
  ".git"
  "dist"
  "build"
)

# Build exclude pattern for grep
EXCLUDE_PATTERN=""
for dir in "${EXCLUDE_DIRS[@]}"; do
  EXCLUDE_PATTERN="$EXCLUDE_PATTERN --exclude-dir=$dir"
done

# File patterns to search
FILE_PATTERNS=(
  "*.css"
  "*.js"
  "*.jsx"
  "*.ts"
  "*.tsx"
  "*.html"
  "*.vue"
)

# Build include pattern for grep
INCLUDE_PATTERN=""
for pattern in "${FILE_PATTERNS[@]}"; do
  INCLUDE_PATTERN="$INCLUDE_PATTERN --include=$pattern"
done

# Search for px values (digits followed by px)
grep -rEn $EXCLUDE_PATTERN $INCLUDE_PATTERN '[0-9]+px' . | \
  grep -v 'node_modules' | \
  grep -v '.next' | \
  grep -v 'vendor' | \
  sort

echo ""
echo "=== Summary ==="
COUNT=$(grep -rE $EXCLUDE_PATTERN $INCLUDE_PATTERN '[0-9]+px' . | \
  grep -v 'node_modules' | \
  grep -v '.next' | \
  grep -v 'vendor' | \
  wc -l)

echo "Total px usages found: $COUNT"
