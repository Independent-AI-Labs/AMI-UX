# Claude Code Development Workflow

This document outlines the complete development workflow for the Hexagonal Message Grid UI project, including background server management, debugging processes, and issue resolution strategies.

## Project Overview

**Location**: `C:\Users\vdonc\AMI-SDA\orchestrator\ui\ui-concept\`

**Tech Stack**: Next.js 15.4.5 with Turbopack, React, Tailwind CSS

**Main Components**:
- Hexagonal message grid with backdrop blur effects
- Level-of-Detail (LoD) system for performance
- Video backdrop
- Interactive UI tiles

## Development Scripts

### Background Server Management

Three scripts have been created for non-blocking development workflow:

#### 1. `start-dev-simple.bat`
```bash
# Starts dev server in background
cmd /c start-dev-simple.bat
```
- Automatically stops any existing server
- Starts server on `192.168.50.63:3000`
- Runs in minimized window to avoid blocking
- Logs output to `dev-server.log`

#### 2. `stop-dev.bat`
```bash
# Stops dev server
cmd /c stop-dev.bat
```
- Kills processes on port 3000
- Cleans up Node.js processes
- Removes temporary files

#### 3. `restart-dev.bat`
```bash
# Full rebuild and restart cycle
cmd /c restart-dev.bat
```
- Stops current server
- Runs `npm run build`
- Restarts server (only if build succeeds)

### Why Background Scripts Are Essential

**Problem**: Running `npm run dev` directly blocks Claude's process and causes timeouts.

**Solution**: Background scripts allow Claude to:
- Start/stop servers without blocking
- Continue debugging while server runs
- Perform full development cycles autonomously

## Current Issues Being Debugged

### 1. Hexagon Positioning Problem
**Symptoms**:
- Message tiles scattered in a line instead of hexagonal clusters
- Missing positioning styles in DOM
- Debug overlays not visible

**Root Cause Investigation**:
- CSS import error was preventing page from loading entirely
- `@import url('https://fonts.googleapis.com/css2?family=Montserrat...')` caused parsing failures
- React app wasn't rendering at all

**Current Status**: 
- ✅ Fixed CSS import issue (removed Google Fonts import)
- ✅ Page now loads properly
- ✅ React app rendering successfully
- 🔍 Next: Investigate hexagon positioning calculations

### 2. Backdrop Blur Not Working
**Symptoms**:
- Backdrop blur works on context menus
- Does not work on hexagon message tiles

**Investigation Approach**:
- Tried pseudo-element approach to separate `clip-path` from `backdrop-filter`
- Added CSS structure: parent has `backdrop-filter`, `::before` has background
- Modified hexagon component structure

**Current Status**: 
- 🔍 Needs verification after positioning fix

## Development Workflow

### Standard Debug Cycle

1. **Modify Code** (add debug info, fix issues)
2. **Build Project**: `npm run build` 
3. **Restart Server**: Use background scripts
4. **Test in Chrome**: Refresh and inspect DOM
5. **Analyze Results**: Console logs, DOM inspection
6. **Iterate**: Repeat cycle

### Chrome MCP Integration

The workflow uses Chrome MCP server for:
- **Page refresh**: `chrome_navigate` with refresh
- **DOM inspection**: `chrome_get_web_content`
- **Script injection**: `chrome_inject_script` for debugging
- **Console monitoring**: `chrome_console` for error tracking

### Example Full Cycle Command Sequence

```bash
# 1. Stop current server
cd "C:\Users\vdonc\AMI-SDA\orchestrator\ui\ui-concept" && cmd /c stop-dev.bat

# 2. Build project  
npm run build

# 3. Start server in background
cmd /c start-dev-simple.bat

# 4. Refresh browser (via Chrome MCP)
# 5. Inject debug scripts (via Chrome MCP)  
# 6. Analyze console output (via Chrome MCP)
```

## Key Learnings

### CSS Import Issues
- Next.js with Turbopack has strict CSS parsing
- `@import` statements must be at the very top
- Font imports can cause cascade failures that prevent entire app from loading
- **Solution**: Use simpler font stacks or load fonts differently

### React Hydration Mismatches
- Server-side rendering can cause hydration mismatches
- Video backdrop positioning calculations cause SSR/client differences
- **Workaround**: Accept hydration warnings for positioning-dependent components

### Hexagon Component Architecture
```javascript
// Current structure
<Hexagon className="hex-with-backdrop">
  <DebugOverlay> // Yellow positioning info
  <HexMessage>   // Actual content
</Hexagon>
```

**Positioning Props**:
- `q, r`: Hex grid coordinates
- `x, y`: Pixel coordinates (calculated via `hexToPixel()`)
- `hexSize`: Size parameter (currently 180)

## Debugging Tools Added

### Debug Overlay
Added to `Hexagon.js`:
```javascript
<div style={{
  position: 'absolute',
  top: '-20px', left: '0',
  fontSize: '10px', color: 'yellow',
  background: 'rgba(0,0,0,0.5)',
  padding: '2px', zIndex: 9999
}}>
  q:{q} r:{r} x:{Math.round(x)} y:{Math.round(y)} size:{hexSize}
</div>
```

### Console Debug Scripts
```javascript
// Check hex positioning
const hexTiles = document.querySelectorAll('.hex-with-backdrop');
console.log('Hex tiles found:', hexTiles.length);
hexTiles.forEach((hex, i) => {
  console.log(`Hex ${i}:`, {
    inlineLeft: hex.style.left,
    inlineTop: hex.style.top,
    computedLeft: getComputedStyle(hex).left,
    computedTop: getComputedStyle(hex).top,
    hasDebugDiv: !!hex.querySelector('div[style*="yellow"]')
  });
});
```

## File Structure

```
ui-concept/
├── src/app/
│   ├── components/
│   │   ├── Hexagon.js           # Core hexagon wrapper with positioning
│   │   ├── HexMessage.js        # Message-specific hexagon
│   │   └── LoD.js               # Level-of-Detail system
│   ├── styles/
│   │   ├── hexagon.css          # Hexagon and backdrop styles
│   │   └── globals.css          # Global styles (fixed CSS import)
│   └── page.js                  # Main grid component
├── start-dev-simple.bat         # Background server start
├── stop-dev.bat                 # Server stop
├── restart-dev.bat              # Full rebuild cycle
└── CLAUDE.md                    # This documentation
```

## Next Steps

1. **Verify Positioning**: Check if hexagons now position correctly after CSS fix
2. **Debug Backdrop Blur**: Test if pseudo-element approach works
3. **Remove Debug Overlays**: Clean up debug code when issues resolved
4. **Restore Google Fonts**: Find proper way to include fonts without breaking build

## Commands Reference

### Quick Development Commands
```bash
# Check if server is running
netstat -an | grep 3000

# Restart development cycle
cmd /c restart-dev.bat

# View server logs (when implemented)
cat dev-server.log
```

### Chrome MCP Commands (via Claude)
```javascript
// Refresh page
mcp__chrome-mcp-server__chrome_navigate({refresh: true})

// Get page content  
mcp__chrome-mcp-server__chrome_get_web_content({htmlContent: true})

// Inject debug script
mcp__chrome-mcp-server__chrome_inject_script({
  type: "MAIN", 
  jsScript: "console.log('Debug script')"
})

// Get console output
mcp__chrome-mcp-server__chrome_console({maxMessages: 20})
```

---

*Last Updated: 2025-08-02*  
*Claude Development Workflow v1.0*