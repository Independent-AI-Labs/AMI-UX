#!/bin/bash

# Convert px to rem safely
# Base: 16px = 1rem

set -e

BASE_PX=16
DRY_RUN=false
FILE_PATTERN=""
MAX_CONVERSIONS=100

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Convert px values to rem in CSS/JS files

OPTIONS:
  -f, --file PATTERN    File pattern to process (e.g., "*.css")
  -d, --dry-run        Show what would change without modifying files
  -m, --max NUM        Maximum number of conversions (default: 100)
  -b, --base NUM       Base px value for 1rem (default: 16)
  -h, --help           Show this help message

EXAMPLES:
  # Dry run on all CSS files
  $(basename "$0") -d -f "*.css"

  # Convert up to 50 font-size values
  $(basename "$0") -m 50 -f "public/styles/*.css"

  # Convert with custom base (20px = 1rem)
  $(basename "$0") -b 20 -f "app.css"

SAFE CONVERSIONS:
  - font-size
  - padding, padding-*
  - margin, margin-*
  - gap, row-gap, column-gap
  - width/height (for larger values >20px)

EXCLUDED (kept as px):
  - border, border-*
  - box-shadow, text-shadow
  - outline, outline-*
  - transform values
  - Small values (1px, 2px)
EOF
  exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -f|--file)
      FILE_PATTERN="$2"
      shift 2
      ;;
    -d|--dry-run)
      DRY_RUN=true
      shift
      ;;
    -m|--max)
      MAX_CONVERSIONS="$2"
      shift 2
      ;;
    -b|--base)
      BASE_PX="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

if [ -z "$FILE_PATTERN" ]; then
  echo -e "${RED}Error: File pattern required${NC}"
  usage
fi

# Safe CSS properties to convert
SAFE_PROPS=(
  "font-size"
  "padding"
  "padding-top"
  "padding-right"
  "padding-bottom"
  "padding-left"
  "margin"
  "margin-top"
  "margin-right"
  "margin-bottom"
  "margin-left"
  "gap"
  "row-gap"
  "column-gap"
  "width"
  "height"
  "max-width"
  "max-height"
  "min-width"
  "min-height"
)

# Convert px to rem
px_to_rem() {
  local px_value=$1
  local rem_value=$(echo "scale=4; $px_value / $BASE_PX" | bc)
  # Remove trailing zeros
  rem_value=$(echo "$rem_value" | sed 's/\.0*$//' | sed 's/\([0-9]\)0*$/\1/')
  echo "${rem_value}rem"
}

# Find files
FILES=$(find . -type f -name "$FILE_PATTERN" \
  ! -path "*/node_modules/*" \
  ! -path "*/.next/*" \
  ! -path "*/vendor/*" \
  ! -path "*/.git/*")

if [ -z "$FILES" ]; then
  echo -e "${RED}No files found matching: $FILE_PATTERN${NC}"
  exit 1
fi

echo -e "${GREEN}Found files:${NC}"
echo "$FILES" | sed 's/^/  /'
echo ""

TOTAL_CHANGES=0
CHANGES_BY_FILE=()

for file in $FILES; do
  if [ $TOTAL_CHANGES -ge $MAX_CONVERSIONS ]; then
    echo -e "${YELLOW}Reached max conversions limit ($MAX_CONVERSIONS)${NC}"
    break
  fi

  TEMP_FILE=$(mktemp)
  cp "$file" "$TEMP_FILE"
  FILE_CHANGES=0

  # Process each safe property
  for prop in "${SAFE_PROPS[@]}"; do
    # Match patterns like: font-size: 16px; or fontSize: '16px'
    # CSS: property: NNpx
    while IFS= read -r line; do
      if echo "$line" | grep -qE "${prop}[[:space:]]*:[[:space:]]*[0-9]+px"; then
        px=$(echo "$line" | grep -oE '[0-9]+' | head -1)

        # Skip small values (1px, 2px) - keep for precision
        if [ "$px" -le 2 ]; then
          continue
        fi

        # For width/height, only convert larger values (>20px)
        if [[ "$prop" =~ ^(width|height|max-|min-) ]] && [ "$px" -le 20 ]; then
          continue
        fi

        rem=$(px_to_rem "$px")
        old_line="$line"
        new_line=$(echo "$line" | sed "s/${px}px/${rem}/g")

        if [ "$DRY_RUN" = true ]; then
          echo -e "${YELLOW}[DRY RUN]${NC} $file"
          echo -e "  ${RED}- $old_line${NC}"
          echo -e "  ${GREEN}+ $new_line${NC}"
        else
          sed -i "s|${old_line}|${new_line}|g" "$TEMP_FILE"
        fi

        FILE_CHANGES=$((FILE_CHANGES + 1))
        TOTAL_CHANGES=$((TOTAL_CHANGES + 1))

        if [ $TOTAL_CHANGES -ge $MAX_CONVERSIONS ]; then
          break 2
        fi
      fi
    done < "$TEMP_FILE"
  done

  if [ "$DRY_RUN" = false ] && [ $FILE_CHANGES -gt 0 ]; then
    mv "$TEMP_FILE" "$file"
    CHANGES_BY_FILE+=("$file: $FILE_CHANGES changes")
    echo -e "${GREEN}✓${NC} $file ($FILE_CHANGES changes)"
  else
    rm "$TEMP_FILE"
  fi
done

echo ""
echo -e "${GREEN}=== Summary ===${NC}"
echo "Total conversions: $TOTAL_CHANGES"
echo ""

if [ "$DRY_RUN" = false ] && [ $TOTAL_CHANGES -gt 0 ]; then
  echo -e "${GREEN}Files modified:${NC}"
  for change in "${CHANGES_BY_FILE[@]}"; do
    echo "  $change"
  done
fi

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}This was a dry run. Use without -d to apply changes.${NC}"
fi
