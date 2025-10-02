#!/usr/bin/env python3
"""
Convert px values to rem safely in CSS/JS files
Base: 16px = 1rem
"""

import argparse
import re
import sys
from pathlib import Path

# Constants
MIN_PX_VALUE = 2  # Skip small values for precision
MIN_DIMENSION_PX = 20  # Minimum for width/height conversions
PREVIEW_LIMIT = 20  # Number of changes to show in preview

# Safe CSS properties to convert
SAFE_PROPS = [
    "font-size",
    "padding",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "margin",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "gap",
    "row-gap",
    "column-gap",
    "width",
    "height",
    "max-width",
    "max-height",
    "min-width",
    "min-height",
]

# Properties to exclude (keep as px)
EXCLUDED_PROPS = [
    "border",
    "border-width",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "outline",
    "outline-width",
    "outline-offset",
    "box-shadow",
    "text-shadow",
    "transform",
    "translate",
]


def px_to_rem(px_value: int, base: int = 16) -> str:
    """Convert px to rem with clean formatting"""
    rem = px_value / base
    # Format nicely, remove trailing zeros
    if rem == int(rem):
        return f"{int(rem)}rem"
    return f"{rem:.4f}".rstrip("0").rstrip(".") + "rem"


def should_convert_property(prop: str) -> bool:
    """Check if property is safe to convert"""
    prop_lower = prop.lower().strip()

    # Exclude unsafe properties
    if any(excluded in prop_lower for excluded in EXCLUDED_PROPS):
        return False

    # Include only safe properties
    return any(safe in prop_lower for safe in SAFE_PROPS)


def process_file(  # noqa: C901
    file_path: Path,
    base_px: int = 16,
    dry_run: bool = False,
    max_conversions: int | None = None,
) -> tuple[int, list[str]]:
    """Process a single file and convert px to rem"""

    changes = []
    conversions = 0

    with file_path.open(encoding="utf-8") as f:
        lines = f.readlines()

    new_lines = []

    for line_num, original_line in enumerate(lines, 1):
        modified_line = original_line

        # CSS pattern: property: NNpx
        css_pattern = r"([\w-]+)\s*:\s*([^;{}]+)"
        matches = re.finditer(css_pattern, modified_line)

        for match in matches:
            prop = match.group(1)
            value = match.group(2)

            if not should_convert_property(prop):
                continue

            # Find px values in the value
            px_pattern = r"(\d+)px"
            px_matches = list(re.finditer(px_pattern, value))

            for px_match in px_matches:
                if max_conversions and conversions >= max_conversions:
                    break

                px_value = int(px_match.group(1))

                # Skip small values - keep for precision
                if px_value <= MIN_PX_VALUE:
                    continue

                # For width/height, only convert larger values
                if any(p in prop.lower() for p in ["width", "height"]) and px_value <= MIN_DIMENSION_PX:
                    continue

                rem_value = px_to_rem(px_value, base_px)
                old_val = f"{px_value}px"

                # Replace in modified line
                modified_line = modified_line.replace(old_val, rem_value, 1)

                changes.append(f"{file_path}:{line_num} | {prop}: {old_val} → {rem_value}")
                conversions += 1

                if max_conversions and conversions >= max_conversions:
                    break

        new_lines.append(modified_line)

        if max_conversions and conversions >= max_conversions:
            # Add remaining lines unchanged
            new_lines.extend(lines[line_num:])
            break

    # Write changes if not dry run
    if not dry_run and conversions > 0:
        with file_path.open("w", encoding="utf-8") as f:
            f.writelines(new_lines)

    return conversions, changes


def main() -> int:  # noqa: C901
    parser = argparse.ArgumentParser(
        description="Convert px values to rem in CSS/JS files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run on CSS files
  %(prog)s -d "public/styles/*.css"

  # Convert up to 50 values
  %(prog)s -m 50 "**/*.css"

  # Custom base (20px = 1rem)
  %(prog)s -b 20 "app.css"

Safe conversions: font-size, padding, margin, gap, width/height (>20px)
Excluded: borders, shadows, outlines, small values (1-2px)
        """,
    )

    parser.add_argument("pattern", help="File pattern (glob)")
    parser.add_argument("-d", "--dry-run", action="store_true", help="Show changes without modifying files")
    parser.add_argument("-m", "--max", type=int, default=None, help="Maximum number of conversions (default: unlimited)")
    parser.add_argument("-b", "--base", type=int, default=16, help="Base px value for 1rem (default: 16)")

    args = parser.parse_args()

    # Find files
    cwd = Path.cwd()
    files = list(cwd.glob(args.pattern))

    # Filter out excluded directories
    excluded_dirs = {"node_modules", ".next", "vendor", ".git", "dist", "build"}
    files = [f for f in files if not any(exc in f.parts for exc in excluded_dirs)]

    if not files:
        print(f"❌ No files found matching: {args.pattern}")
        return 1

    print(f"📁 Found {len(files)} file(s):")
    for f in files:
        print(f"  {f.relative_to(cwd)}")
    print()

    total_conversions = 0
    all_changes = []

    for file_path in files:
        if args.max and total_conversions >= args.max:
            print(f"⚠️  Reached max conversions limit ({args.max})")
            break

        remaining = args.max - total_conversions if args.max else None
        conversions, changes = process_file(file_path, base_px=args.base, dry_run=args.dry_run, max_conversions=remaining)

        if conversions > 0:
            rel_path = file_path.relative_to(cwd)
            if args.dry_run:
                print(f"🔍 [DRY RUN] {rel_path} ({conversions} changes)")
            else:
                print(f"✅ {rel_path} ({conversions} changes)")

            all_changes.extend(changes)
            total_conversions += conversions

    print()
    print("=" * 60)
    print(f"📊 Total conversions: {total_conversions}")

    if args.dry_run and all_changes:
        print(f"\n🔍 Changes preview (first {PREVIEW_LIMIT}):")
        for change in all_changes[:PREVIEW_LIMIT]:
            print(f"  {change}")
        if len(all_changes) > PREVIEW_LIMIT:
            print(f"  ... and {len(all_changes) - PREVIEW_LIMIT} more")

    if args.dry_run:
        print("\n⚠️  This was a dry run. Remove -d to apply changes.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
