# Open Content Directory Item

## Recorded Steps
1. Navigate to `https://localhost:3000`, click the **Advanced** button (selector: `#details-button`) on the cert warning, then click **Proceed to localhost (unsafe)** (selector: `#proceed-link`).
2. On the welcome screen, locate and click the **Continue as Guest** button. Use JavaScript if direct selector matching fails: find all buttons and match by text content.
3. Press the **Open Content Directory** button (selector: `#welcomeOpenBtn`) to reveal the drawer on the right. The drawer element is `.content-drawer-surface`.
4. Right-click the `Docs` entry in the drawer (selector: `.drawer-list-item[data-entry-path="/home/ami/Projects/AMI-ORCHESTRATOR/docs"]`). Note: Standard right-click may not trigger the context menu; dispatch a `contextmenu` event programmatically if needed. The menu class is `.ami-context-menu`.
5. From the context menu, locate the menu item with text "Open" and click it. Menu items may need to be found by text content rather than specific selectors.
6. Wait for the workspace to load. Verify the iframe (selector: `iframe.viz-frame.is-active`) loads with `src="/doc?embed=1"`, then check inside the iframe for the structure panel (class: `structure-nav`) and confirm the body has class `doc-viewer`.

## Saved Browser Session
- Session ID: `c442c188-fbf1-47eb-a92b-4d40f5cf4813`
- Session name: `open-content-directory-docs`
