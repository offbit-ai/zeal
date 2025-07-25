// Manual test script to run in browser console
// This script will simulate drag and drop of nodes to the canvas

console.log('Starting drag and drop test...');

// Helper function to simulate drag and drop
function simulateDragDrop(sourceSelector, targetSelector, offsetX = 0, offsetY = 0) {
  const source = document.querySelector(sourceSelector);
  const target = document.querySelector(targetSelector);
  
  if (!source || !target) {
    console.error('Source or target element not found', { source: sourceSelector, target: targetSelector });
    return false;
  }
  
  // Get bounding boxes
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  
  // Create drag start event
  const dragStartEvent = new DragEvent('dragstart', {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });
  
  // Create drop event
  const dropEvent = new DragEvent('drop', {
    bubbles: true,
    cancelable: true,
    clientX: targetRect.left + offsetX,
    clientY: targetRect.top + offsetY,
    dataTransfer: new DataTransfer()
  });
  
  // Simulate the drag and drop
  source.dispatchEvent(dragStartEvent);
  target.dispatchEvent(dropEvent);
  
  console.log(`Dragged ${sourceSelector} to ${targetSelector}`);
  return true;
}

// Wait for page to be ready
setTimeout(() => {
  console.log('Testing drag and drop functionality...');
  
  // Test 1: Drag "Get Database" action node
  const getDatabaseResult = simulateDragDrop(
    'text=Get Database', 
    '[data-testid="workflow-canvas"]',
    200, 150
  );
  
  // Test 2: Drag "AI Agent 1" node
  setTimeout(() => {
    const aiAgentResult = simulateDragDrop(
      'text=AI Agent 1',
      '[data-testid="workflow-canvas"]', 
      400, 200
    );
  }, 1000);
  
  // Test 3: Drag "If 1" condition node
  setTimeout(() => {
    const ifResult = simulateDragDrop(
      'text=If 1',
      '[data-testid="workflow-canvas"]',
      300, 300
    );
    
    console.log('All drag and drop tests completed');
  }, 2000);
  
}, 1000);

console.log('Script loaded. Drag and drop test will start in 1 second...');