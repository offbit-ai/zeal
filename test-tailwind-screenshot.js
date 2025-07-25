const { chromium } = require('playwright');

(async () => {
  // Launch browser
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to the test page
    console.log('Navigating to http://localhost:3000/test...');
    await page.goto('http://localhost:3000/test', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait a bit for any CSS to fully load
    await page.waitForTimeout(2000);
    
    // Create screenshots directory if it doesn't exist
    const fs = require('fs');
    const path = require('path');
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    // Take screenshot
    const screenshotPath = path.join(screenshotsDir, 'tailwind-v4-test.png');
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    
    console.log(`Screenshot saved to: ${screenshotPath}`);
    
    // Get page title for verification
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
  } catch (error) {
    console.error('Error occurred:', error);
  } finally {
    // Close browser
    await browser.close();
  }
})();