# px to rem Conversion Scripts

Two scripts for finding and converting px dimensions to rem units.

## 1. Find px dimensions

**Script:** `find-px-dimensions.sh`

Searches the entire app for px values and generates a report.

```bash
./scripts/find-px-dimensions.sh
```

Output saved to: `scripts/px-dimensions-report.txt`

## 2. Convert px to rem

**Script:** `px-to-rem.py`

Safely converts px values to rem with configurable options.

### Safe Conversions

The script ONLY converts these CSS properties:
- ✅ `font-size`
- ✅ `padding`, `padding-*`
- ✅ `margin`, `margin-*`
- ✅ `gap`, `row-gap`, `column-gap`
- ✅ `width`, `height` (only values >20px)
- ✅ `max-width`, `max-height`, `min-width`, `min-height`

### Excluded (kept as px)

These are NEVER converted:
- ❌ `border`, `border-width`, etc.
- ❌ `box-shadow`, `text-shadow`
- ❌ `outline`, `outline-width`
- ❌ `transform`, `translate`
- ❌ Small values (1px, 2px)

### Usage Examples

#### 1. Dry run (preview only)
```bash
# See what would change in all CSS files
python3 scripts/px-to-rem.py -d "**/*.css"

# Check specific file
python3 scripts/px-to-rem.py -d "app/auth/styles.css"

# Limit to first 20 conversions
python3 scripts/px-to-rem.py -d -m 20 "public/styles/*.css"
```

#### 2. Apply changes
```bash
# Convert up to 100 values in shared.css
python3 scripts/px-to-rem.py -m 100 "public/styles/shared.css"

# Convert all font-sizes in app directory
python3 scripts/px-to-rem.py "app/**/*.css"

# Use custom base (20px = 1rem instead of 16px)
python3 scripts/px-to-rem.py -b 20 "public/styles/theme.css"
```

#### 3. Recommended workflow

**Step 1:** Always dry-run first
```bash
python3 scripts/px-to-rem.py -d -m 100 "public/styles/shared.css"
```

**Step 2:** Review the changes

**Step 3:** Apply in small batches
```bash
python3 scripts/px-to-rem.py -m 50 "public/styles/shared.css"
```

**Step 4:** Test the UI

**Step 5:** Repeat until manageable

### Options

```
-d, --dry-run       Preview changes without modifying files
-m, --max NUM       Maximum number of conversions (default: unlimited)
-b, --base NUM      Base px value for 1rem (default: 16)
```

### Example Output

```
📁 Found 1 file(s):
  app/auth/styles.css

✅ app/auth/styles.css (10 changes)

============================================================
📊 Total conversions: 10

🔍 Changes preview:
  app/auth/styles.css:12 | padding: 32px → 2rem
  app/auth/styles.css:18 | width: 420px → 26.25rem
  app/auth/styles.css:43 | font-size: 26px → 1.625rem
  ...
```

## Strategy for manageable conversion

Current: **1,699 px usages** (from find-px-dimensions.sh)

**Recommended approach:**

1. **Start with font-sizes only** (most impactful for accessibility)
   ```bash
   # Find all font-sizes with px
   grep -r "font-size.*px" public/styles --include="*.css"

   # Convert them
   python3 scripts/px-to-rem.py -m 200 "public/styles/**/*.css"
   ```

2. **Then padding/margin in layout files**
   ```bash
   python3 scripts/px-to-rem.py -m 200 "public/styles/shared.css"
   ```

3. **Then component-specific styles**
   ```bash
   python3 scripts/px-to-rem.py -m 100 "app/**/*.css"
   ```

4. **Target: Get down to ~500 px usages**
   - Remaining px should be:
     - Borders (1px, 2px)
     - Shadows
     - Precision values
     - Small UI elements

## Why rem?

- **Accessibility**: Respects user's font size preferences
- **Responsive**: Scales proportionally
- **Maintainable**: Change base size in one place
- **Best practice**: Modern CSS standard

## Base calculation

Default: **16px = 1rem**

Examples:
- 8px → 0.5rem
- 12px → 0.75rem
- 14px → 0.875rem
- 16px → 1rem
- 20px → 1.25rem
- 24px → 1.5rem
- 32px → 2rem
