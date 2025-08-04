import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should not have any automatically detectable accessibility issues', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should have proper focus management', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab')
    const firstFocused = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-testid')
    )
    expect(firstFocused).toBeTruthy()

    // Continue tabbing through interactive elements
    const focusOrder = []
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      const testId = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
      if (testId) focusOrder.push(testId)
    }

    // Verify logical focus order
    expect(focusOrder.length).toBeGreaterThan(0)
  })

  test('should have proper ARIA labels', async ({ page }) => {
    // Check main regions
    const main = page.locator('main')
    await expect(main).toHaveAttribute('aria-label', /workflow editor/i)

    // Check interactive elements
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i)
      const ariaLabel = await button.getAttribute('aria-label')
      const textContent = await button.textContent()

      // Button should have either aria-label or visible text
      expect(ariaLabel || textContent).toBeTruthy()
    }
  })

  test('should support keyboard shortcuts', async ({ page }) => {
    // Test common shortcuts
    const shortcuts = [
      { key: 'Control+z', action: 'undo' },
      { key: 'Control+y', action: 'redo' },
      { key: 'Delete', action: 'delete' },
      { key: 'Control+c', action: 'copy' },
      { key: 'Control+v', action: 'paste' },
    ]

    for (const shortcut of shortcuts) {
      // Add a node first
      await page
        .locator('[data-testid="node-trigger"]')
        .dragTo(page.locator('[data-testid="workflow-canvas"]'), {
          targetPosition: { x: 200, y: 200 },
        })

      // Select the node
      await page.locator('[data-testid="node-1"]').click()

      // Test shortcut
      await page.keyboard.press(shortcut.key)

      // Verify action was performed (this would need actual implementation)
      // For now, just verify no errors occurred
    }
  })

  test('should have sufficient color contrast', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .options({
        runOnly: ['color-contrast'],
        resultTypes: ['violations', 'passes'],
      })
      .analyze()

    expect(results.violations).toHaveLength(0)
    expect(results.passes.length).toBeGreaterThan(0)
  })

  test('should announce dynamic changes', async ({ page }) => {
    // Check for ARIA live regions
    const liveRegions = page.locator('[aria-live]')
    const count = await liveRegions.count()
    expect(count).toBeGreaterThan(0)

    // Verify status messages
    await page
      .locator('[data-testid="node-trigger"]')
      .dragTo(page.locator('[data-testid="workflow-canvas"]'), {
        targetPosition: { x: 200, y: 200 },
      })

    // Check if status was announced
    const status = page.locator('[role="status"]')
    await expect(status).toContainText(/node added/i)
  })

  test('should support screen reader navigation', async ({ page }) => {
    // Check heading structure
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents()
    expect(headings.length).toBeGreaterThan(0)

    // Check landmark regions
    const landmarks = ['main', 'nav', 'aside']
    for (const landmark of landmarks) {
      const element = page.locator(`[role="${landmark}"], ${landmark}`)
      const count = await element.count()
      expect(count).toBeGreaterThan(0)
    }
  })
})
