const { chromium } = require('playwright');

async function testDragAndDrop() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);
  
  // Test 1: Drag "Get Database" action node
  console.log('Testing drag and drop of Get Database node...');
  await page.locator('text=Get Database').dragTo(page.locator('[data-testid="workflow-canvas"], .react-flow__pane, [class*="canvas"]').first());
  await page.waitForTimeout(1000);
  
  // Test 2: Drag "AI Agent 1" node
  console.log('Testing drag and drop of AI Agent 1 node...');
  await page.locator('text=AI Agent 1').dragTo(page.locator('[data-testid="workflow-canvas"], .react-flow__pane, [class*="canvas"]').first());
  await page.waitForTimeout(1000);
  
  // Test 3: Drag "If 1" condition node
  console.log('Testing drag and drop of If 1 node...');
  await page.locator('text=If 1').dragTo(page.locator('[data-testid="workflow-canvas"], .react-flow__pane, [class*="canvas"]').first());
  await page.waitForTimeout(1000);
  
  // Take screenshot after drag and drop
  await page.screenshot({ path: 'screenshots/workflow-after-drag-drop.png', fullPage: true });
  
  // Try to connect some nodes if possible
  console.log('Attempting to connect nodes...');
  try {
    // Look for connection handles and try to connect them
    const sourceHandles = await page.locator('[class*="handle-source"], [class*="source-handle"], .react-flow__handle-right').all();
    const targetHandles = await page.locator('[class*="handle-target"], [class*="target-handle"], .react-flow__handle-left').all();
    
    if (sourceHandles.length > 0 && targetHandles.length > 0) {
      await sourceHandles[0].hover();
      await page.mouse.down();
      await targetHandles[0].hover();
      await page.mouse.up();
      await page.waitForTimeout(1000);
    }
  } catch (error) {
    console.log('Connection attempt failed:', error.message);
  }
  
  // Take final screenshot
  await page.screenshot({ path: 'screenshots/workflow-with-connections.png', fullPage: true });
  
  await browser.close();
}

testDragAndDrop().catch(console.error);