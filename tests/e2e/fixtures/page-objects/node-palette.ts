import { Page, Locator } from '@playwright/test';

export class NodePalette {
  readonly page: Page;
  readonly palette: Locator;
  readonly searchInput: Locator;
  readonly categoryTabs: Locator;

  constructor(page: Page) {
    this.page = page;
    this.palette = page.locator('[data-testid="node-palette"]');
    this.searchInput = page.locator('[data-testid="node-search"]');
    this.categoryTabs = page.locator('[data-testid="category-tab"]');
  }

  async searchNodes(query: string) {
    await this.searchInput.fill(query);
  }

  async selectCategory(category: string) {
    await this.page.locator(`[data-testid="category-tab-${category}"]`).click();
  }

  async getNodeByType(nodeType: string): Promise<Locator> {
    return this.palette.locator(`[data-testid="palette-node-${nodeType}"]`);
  }

  async getVisibleNodes(): Promise<Locator[]> {
    return await this.palette.locator('[data-testid^="palette-node-"]').all();
  }

  async expandCategory(category: string) {
    const categoryHeader = this.page.locator(`[data-testid="category-${category}"]`);
    const isExpanded = await categoryHeader.getAttribute('aria-expanded');
    
    if (isExpanded !== 'true') {
      await categoryHeader.click();
    }
  }

  async collapseCategory(category: string) {
    const categoryHeader = this.page.locator(`[data-testid="category-${category}"]`);
    const isExpanded = await categoryHeader.getAttribute('aria-expanded');
    
    if (isExpanded === 'true') {
      await categoryHeader.click();
    }
  }
}