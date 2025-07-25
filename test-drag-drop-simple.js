const { chromium } = require('playwright');

async function testDragAndDrop() {
  // Connect to existing browser instance
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  let page;
  
  if (contexts.length > 0) {
    const pages = await contexts[0].pages();
    page = pages.find(p => p.url().includes('localhost:3000')) || pages[0];
  } else {
    const context = await browser.newContext();
    page = await context.newPage();
    await page.goto('http://localhost:3000');
  }
  
  await page.waitForTimeout(2000);
  
  try {
    // Try to find the canvas area
    const canvas = page.locator('[data-testid="workflow-canvas"]');
    await canvas.waitFor({ state: 'visible' });
    
    // Get bounding box of canvas for positioning
    const canvasBox = await canvas.boundingBox();
    
    // Test 1: Try to drag "Get Database" node
    console.log('Testing drag of Get Database node...');
    const getDatabaseNode = page.locator('text=Get Database');
    
    // Use mouse actions for more precise control
    const nodeBox = await getDatabaseNode.boundingBox();
    if (nodeBox && canvasBox) {
      await page.mouse.move(nodeBox.x + nodeBox.width/2, nodeBox.y + nodeBox.height/2);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + 200, canvasBox.y + 150);
      await page.mouse.up();
      await page.waitForTimeout(1000);
    }
    
    // Test 2: Try to drag "AI Agent 1" node
    console.log('Testing drag of AI Agent 1 node...');
    const aiAgentNode = page.locator('text=AI Agent 1');
    const aiNodeBox = await aiAgentNode.boundingBox();
    if (aiNodeBox && canvasBox) {
      await page.mouse.move(aiNodeBox.x + aiNodeBox.width/2, aiNodeBox.y + aiNodeBox.height/2);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + 400, canvasBox.y + 200);
      await page.mouse.up();
      await page.waitForTimeout(1000);
    }
    
    // Test 3: Try to drag "If 1" node
    console.log('Testing drag of If 1 node...');
    const ifNode = page.locator('text=If 1');
    const ifNodeBox = await ifNode.boundingBox();
    if (ifNodeBox && canvasBox) {
      await page.mouse.move(ifNodeBox.x + ifNodeBox.width/2, ifNodeBox.y + ifNodeBox.height/2);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + 300, canvasBox.y + 300);
      await page.mouse.up();
      await page.waitForTimeout(1000);
    }
    
    console.log('Drag and drop tests completed');
    
  } catch (error) {
    console.log('Error during testing:', error.message);
  }
  
  // Don't close the browser, just disconnect
  await browser.close();
}

testDragAndDrop().catch(console.error);