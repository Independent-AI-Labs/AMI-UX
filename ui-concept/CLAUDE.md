# Claude Development Workflow

This document outlines the established workflow for development tasks in this project.

## General Development Workflow

### 1. Task Planning and Analysis
- Use TodoWrite tool to break down complex tasks into specific, trackable items
- Analyze existing code structure before making changes
- Identify components, hooks, utilities, and data that can be extracted
- Plan the refactoring approach following React/Next.js best practices

### 2. Modular Refactoring Approach
When refactoring large files (like page.js):
- **Extract Components**: Create focused components with single responsibilities
  - Grid/layout components (`components/grid/`)
  - UI system components (`components/backdrop/`, `components/modal/`)
  - Feature-specific components (`components/drag/`)
- **Extract Hooks**: Move business logic into custom hooks (`hooks/`)
- **Extract Utilities**: Move pure functions to utility modules (`utils/`)
- **Extract Data**: Move constants and initial data to data modules (`data/`)

### 3. Directory Structure Standards
```
src/app/
├── components/
│   ├── backdrop/         # Backdrop rendering components
│   ├── drag/            # Drag and drop system
│   ├── grid/            # Grid layout components
│   ├── modal/           # Modal and overlay components
│   └── [existing]/      # Existing UI components
├── hooks/               # Custom React hooks
├── utils/               # Pure utility functions
├── data/                # Constants and initial data
└── [existing files]     # Core application files
```

### 4. Server Management
Use the provided scripts for development server control:
- **Start server**: `node start-server.js` (runs in background, doesn't block)
- **Stop server**: `node stop-server.js` (kills port 3000 processes)

### 5. Testing and Verification
Before committing changes:
1. **Build Test**: Run `npm run build` to ensure no syntax/import errors
2. **Runtime Test**: Start dev server and verify functionality in browser
3. **Chrome MCP Testing**: Use Chrome MCP server to navigate to `http://localhost:3000` and verify content loads correctly

### 6. Git Workflow
- Always stage all changes with `git add .`
- Remove any problematic files (like `nul`) before staging
- Use descriptive commit messages with emoji prefixes:
  ```
  🔧 Refactor [component] into modular [description]
  ✨ Add [new feature]
  🐛 Fix [bug description]
  📝 Update documentation
  ```
- Document key metrics (e.g., "44% size reduction", "Build passes", "Runtime verified")
- NO CO-AUTHORED STUFF!!!

### 7. Best Practices Followed
- **Single Responsibility Principle**: Each component/hook has one clear purpose
- **Component Composition**: Build complex UIs from simple, focused components
- **Custom Hooks**: Extract business logic from components
- **Clean Imports**: Use absolute imports and group logically
- **Prop Drilling Prevention**: Pass only necessary props
- **Performance**: Use useCallback/useMemo appropriately

## Key Tools and Commands

### Development Commands
- `npm run build` - Production build and verification
- `npm run dev` - Development server (use scripts for background operation)
- `node start-server.js` - Background dev server start
- `node stop-server.js` - Stop all processes on port 3000

### Git Commands
- `git status` - Check file changes
- `git add .` - Stage all changes
- `git commit -m "message"` - Commit with message
- `npx kill-port 3000` - Emergency port cleanup

### File Management
- Always use absolute paths in tools
- Prefer editing existing files over creating new ones
- Use MultiEdit for multiple changes to same file
- Use TodoWrite for task tracking on complex refactoring

## Success Metrics
A successful refactoring should achieve:
- ✅ **Size Reduction**: Significant line count reduction in main file
- ✅ **Build Success**: `npm run build` passes without errors
- ✅ **Runtime Verification**: Application loads and functions correctly
- ✅ **Modular Structure**: Clear separation of concerns
- ✅ **Maintainability**: Code is easier to understand and modify

## Example: page.js Refactoring Results
- **Before**: 1,452 lines (monolithic)
- **After**: 810 lines (44% reduction)
- **New Modules**: 8 focused components/hooks created
- **Status**: ✅ Build passes, ✅ Runtime verified, ✅ All functionality preserved