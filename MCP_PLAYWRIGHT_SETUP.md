# MCP Playwright Server Setup Guide

## Overview
This guide will help you set up the MCP Playwright Server for testing the workflow orchestrator UI during development.

## Prerequisites
- Node.js 18+ installed
- Claude Desktop app (if using with Claude)
- A running instance of the workflow orchestrator

## Installation Steps

### 1. Install MCP Playwright Server Globally
```bash
npm install -g @executeautomation/playwright-mcp-server
```

### 2. Configure Claude Desktop (if applicable)
Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server"]
    }
  }
}
```

### 3. Restart Claude Desktop
After adding the configuration, restart Claude Desktop to load the MCP server.

### 4. Verify Installation
In Claude, you should now have access to browser automation capabilities. The server will allow:
- Opening browsers
- Navigating to URLs
- Clicking elements
- Filling forms
- Taking screenshots
- Extracting page content

## Project Setup

### 1. Install Playwright in Your Project
```bash
cd /Users/amaterasu/Vibranium/zeal
npm init -y
npm install --save-dev @playwright/test
npx playwright install
```

### 2. Create Playwright Configuration
Create `playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

## Usage During Development

### With MCP (via Claude)
1. Start your development server: `npm run dev`
2. Ask Claude to test specific features:
   - "Open the workflow editor and create a new trigger node"
   - "Test the connection drawing between two nodes"
   - "Verify the node property panel updates correctly"

### Manual Playwright Commands
```bash
# Run all tests
npx playwright test

# Run tests in UI mode (recommended for development)
npx playwright test --ui

# Run tests in headed mode
npx playwright test --headed

# Generate tests by recording
npx playwright codegen localhost:3000

# Debug a specific test
npx playwright test --debug tests/e2e/workflow-editor.spec.ts
```

## Test Structure
```
tests/
├── e2e/
│   ├── fixtures/
│   │   ├── test-workflows.ts
│   │   └── page-objects/
│   │       ├── workflow-canvas.ts
│   │       ├── node-palette.ts
│   │       └── property-panel.ts
│   ├── workflow-editor.spec.ts
│   ├── node-operations.spec.ts
│   └── connection-drawing.spec.ts
└── helpers/
    └── test-utils.ts
```

## Example Test
```typescript
// tests/e2e/workflow-editor.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Workflow Editor', () => {
  test('should create a new workflow', async ({ page }) => {
    await page.goto('/');
    
    // Wait for canvas to load
    await expect(page.locator('[data-testid="workflow-canvas"]')).toBeVisible();
    
    // Drag a trigger node from palette to canvas
    const triggerNode = page.locator('[data-testid="node-trigger"]');
    const canvas = page.locator('[data-testid="workflow-canvas"]');
    
    await triggerNode.dragTo(canvas, {
      targetPosition: { x: 200, y: 200 }
    });
    
    // Verify node was added
    await expect(page.locator('[data-testid="node-1"]')).toBeVisible();
  });
});
```

## Debugging Tips
1. Use `page.pause()` to stop execution and debug
2. Take screenshots: `await page.screenshot({ path: 'debug.png' })`
3. Use the Playwright Inspector: `PWDEBUG=1 npx playwright test`
4. Check the HTML report: `npx playwright show-report`

## Next Steps
1. Create the initial project structure
2. Set up the development environment
3. Create base page objects for testing
4. Write initial test cases for core workflows