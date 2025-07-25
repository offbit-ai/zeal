import { Page, Locator } from '@playwright/test';

export class WorkflowCanvas {
  readonly page: Page;
  readonly canvas: Locator;
  readonly zoomInButton: Locator;
  readonly zoomOutButton: Locator;
  readonly fitViewButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.canvas = page.locator('[data-testid="workflow-canvas"]');
    this.zoomInButton = page.locator('[data-testid="zoom-in"]');
    this.zoomOutButton = page.locator('[data-testid="zoom-out"]');
    this.fitViewButton = page.locator('[data-testid="fit-view"]');
  }

  async waitForLoad() {
    await this.canvas.waitFor({ state: 'visible' });
  }

  async dragNodeToCanvas(nodeType: string, position: { x: number; y: number }) {
    const node = this.page.locator(`[data-testid="node-${nodeType}"]`);
    await node.dragTo(this.canvas, {
      targetPosition: position
    });
  }

  async getNode(nodeId: string): Promise<Locator> {
    return this.page.locator(`[data-testid="node-${nodeId}"]`);
  }

  async connectNodes(sourceId: string, targetId: string) {
    const sourceHandle = this.page.locator(`[data-testid="node-${sourceId}"] [data-testid="output-handle"]`);
    const targetHandle = this.page.locator(`[data-testid="node-${targetId}"] [data-testid="input-handle"]`);
    
    await sourceHandle.dragTo(targetHandle);
  }

  async panCanvas(deltaX: number, deltaY: number) {
    const canvasCenter = await this.canvas.boundingBox();
    if (!canvasCenter) throw new Error('Canvas not found');

    await this.page.mouse.move(
      canvasCenter.x + canvasCenter.width / 2,
      canvasCenter.y + canvasCenter.height / 2
    );
    await this.page.mouse.down();
    await this.page.mouse.move(
      canvasCenter.x + canvasCenter.width / 2 + deltaX,
      canvasCenter.y + canvasCenter.height / 2 + deltaY
    );
    await this.page.mouse.up();
  }

  async zoomIn() {
    await this.zoomInButton.click();
  }

  async zoomOut() {
    await this.zoomOutButton.click();
  }

  async fitToView() {
    await this.fitViewButton.click();
  }

  async deleteNode(nodeId: string) {
    const node = await this.getNode(nodeId);
    await node.click();
    await this.page.keyboard.press('Delete');
  }

  async selectMultipleNodes(nodeIds: string[]) {
    for (let i = 0; i < nodeIds.length; i++) {
      const node = await this.getNode(nodeIds[i]);
      if (i === 0) {
        await node.click();
      } else {
        await node.click({ modifiers: ['Shift'] });
      }
    }
  }
}