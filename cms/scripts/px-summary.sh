#!/bin/bash

# Analyze px usage patterns to help prioritize conversions

echo "=== px Usage Analysis ==="
echo ""

# Exclude patterns
EXCLUDE="--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=vendor --exclude-dir=.git"
INCLUDE="--include=*.css --include=*.js --include=*.jsx --include=*.tsx --include=*.html"

echo "📊 Top 20 most common px values:"
echo ""
grep -rhoE '[0-9]+px' . $EXCLUDE $INCLUDE | sort | uniq -c | sort -rn | head -20 | \
  awk '{printf "  %4d occurrences: %s\n", $1, $2}'

echo ""
echo "📏 By property type:"
echo ""

echo "  Font sizes:"
grep -rhE 'font-size.*[0-9]+px' . $EXCLUDE $INCLUDE | \
  grep -oE '[0-9]+px' | sort | uniq -c | sort -rn | head -5 | \
  awk '{printf "    %3d × %s\n", $1, $2}'

echo ""
echo "  Padding:"
grep -rhE 'padding[^:]*:[^;]*[0-9]+px' . $EXCLUDE $INCLUDE | \
  grep -oE '[0-9]+px' | sort | uniq -c | sort -rn | head -5 | \
  awk '{printf "    %3d × %s\n", $1, $2}'

echo ""
echo "  Margin:"
grep -rhE 'margin[^:]*:[^;]*[0-9]+px' . $EXCLUDE $INCLUDE | \
  grep -oE '[0-9]+px' | sort | uniq -c | sort -rn | head -5 | \
  awk '{printf "    %3d × %s\n", $1, $2}'

echo ""
echo "  Gap:"
grep -rhE 'gap:[^;]*[0-9]+px' . $EXCLUDE $INCLUDE | \
  grep -oE '[0-9]+px' | sort | uniq -c | sort -rn | head -5 | \
  awk '{printf "    %3d × %s\n", $1, $2}'

echo ""
echo "  Border:"
grep -rhE 'border[^:]*:[^;]*[0-9]+px' . $EXCLUDE $INCLUDE | \
  grep -oE '[0-9]+px' | sort | uniq -c | sort -rn | head -5 | \
  awk '{printf "    %3d × %s\n", $1, $2}'

echo ""
echo "📁 By file:"
echo ""
grep -rhc '[0-9]+px' . $EXCLUDE $INCLUDE | \
  grep -v ':0$' | \
  awk -F: '{print $2 " " $1}' | \
  sort -rn | \
  head -10 | \
  awk '{printf "  %4d px values in %s\n", $1, $2}'

echo ""
echo "💡 Recommendations:"
echo ""

# Count convertible values
FONT_SIZE=$(grep -rc 'font-size.*[0-9]+px' . $EXCLUDE $INCLUDE | awk -F: '{sum+=$2} END {print sum}')
PADDING=$(grep -rc 'padding.*[0-9]+px' . $EXCLUDE $INCLUDE | awk -F: '{sum+=$2} END {print sum}')
MARGIN=$(grep -rc 'margin.*[0-9]+px' . $EXCLUDE $INCLUDE | awk -F: '{sum+=$2} END {print sum}')
GAP=$(grep -rc 'gap.*[0-9]+px' . $EXCLUDE $INCLUDE | awk -F: '{sum+=$2} END {print sum}')

echo "  Safe to convert to rem:"
echo "    - Font sizes: ~$FONT_SIZE occurrences"
echo "    - Padding:    ~$PADDING occurrences"
echo "    - Margin:     ~$MARGIN occurrences"
echo "    - Gap:        ~$GAP occurrences"
echo ""
echo "  Total convertible: ~$((FONT_SIZE + PADDING + MARGIN + GAP))"
echo ""
echo "  Start with: python3 scripts/px-to-rem.py -d -m 100 \"**/*.css\""
