import { test, expect } from '@playwright/test'
import { WorkflowCanvas } from '../fixtures/page-objects/workflow-canvas'
import { NodePalette } from '../fixtures/page-objects/node-palette'

test.describe('Workflow Canvas', () => {
  let canvas: WorkflowCanvas
  let palette: NodePalette

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    canvas = new WorkflowCanvas(page)
    palette = new NodePalette(page)
    await canvas.waitForLoad()
  })

  test('should display empty canvas on load', async ({ page }) => {
    await expect(canvas.canvas).toBeVisible()
    const nodes = await page.locator('[data-testid^="node-"]').count()
    expect(nodes).toBe(0)
  })

  test('should add node via drag and drop', async ({ page }) => {
    // Drag trigger node to canvas
    await canvas.dragNodeToCanvas('trigger', { x: 200, y: 200 })

    // Verify node was added
    const node = await canvas.getNode('1')
    await expect(node).toBeVisible()

    // Verify node position
    const boundingBox = await node.boundingBox()
    expect(boundingBox).toBeTruthy()
    expect(boundingBox!.x).toBeGreaterThan(100)
    expect(boundingBox!.y).toBeGreaterThan(100)
  })

  test('should connect two nodes', async ({ page }) => {
    // Add two nodes
    await canvas.dragNodeToCanvas('trigger', { x: 200, y: 200 })
    await canvas.dragNodeToCanvas('action', { x: 400, y: 200 })

    // Connect them
    await canvas.connectNodes('1', '2')

    // Verify connection exists
    const connection = page.locator('[data-testid="connection-1-2"]')
    await expect(connection).toBeVisible()
  })

  test('should pan canvas', async ({ page }) => {
    // Add a node for reference
    await canvas.dragNodeToCanvas('trigger', { x: 200, y: 200 })
    const node = await canvas.getNode('1')

    // Get initial position
    const initialBox = await node.boundingBox()

    // Pan canvas
    await canvas.panCanvas(100, 50)

    // Verify node moved
    const newBox = await node.boundingBox()
    expect(newBox!.x).toBeGreaterThan(initialBox!.x)
    expect(newBox!.y).toBeGreaterThan(initialBox!.y)
  })

  test('should zoom in and out', async ({ page }) => {
    // Add a node
    await canvas.dragNodeToCanvas('trigger', { x: 200, y: 200 })
    const node = await canvas.getNode('1')

    // Get initial size
    const initialBox = await node.boundingBox()

    // Zoom in
    await canvas.zoomIn()
    await page.waitForTimeout(300) // Wait for animation

    // Verify node is larger
    const zoomedInBox = await node.boundingBox()
    expect(zoomedInBox!.width).toBeGreaterThan(initialBox!.width)

    // Zoom out
    await canvas.zoomOut()
    await canvas.zoomOut()
    await page.waitForTimeout(300)

    // Verify node is smaller
    const zoomedOutBox = await node.boundingBox()
    expect(zoomedOutBox!.width).toBeLessThan(initialBox!.width)
  })

  test('should delete node with keyboard', async ({ page }) => {
    // Add a node
    await canvas.dragNodeToCanvas('trigger', { x: 200, y: 200 })
    const node = await canvas.getNode('1')
    await expect(node).toBeVisible()

    // Delete it
    await canvas.deleteNode('1')

    // Verify it's gone
    await expect(node).not.toBeVisible()
  })

  test('should select multiple nodes', async ({ page }) => {
    // Add three nodes
    await canvas.dragNodeToCanvas('trigger', { x: 200, y: 200 })
    await canvas.dragNodeToCanvas('action', { x: 400, y: 200 })
    await canvas.dragNodeToCanvas('action', { x: 600, y: 200 })

    // Select multiple
    await canvas.selectMultipleNodes(['1', '2', '3'])

    // Verify all are selected
    const selectedNodes = page.locator('[data-selected="true"]')
    await expect(selectedNodes).toHaveCount(3)
  })

  test('should fit view to show all nodes', async ({ page }) => {
    // Add nodes at different positions
    await canvas.dragNodeToCanvas('trigger', { x: 100, y: 100 })
    await canvas.dragNodeToCanvas('action', { x: 800, y: 600 })

    // Fit to view
    await canvas.fitToView()
    await page.waitForTimeout(500) // Wait for animation

    // Verify both nodes are visible
    const node1 = await canvas.getNode('1')
    const node2 = await canvas.getNode('2')
    await expect(node1).toBeInViewport()
    await expect(node2).toBeInViewport()
  })
})
