"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { NodeGroup } from "@/types/workflow";
import { useWorkflowStore } from "@/store/workflow-store";
import { Edit2, Trash2 } from "lucide-react";
import { NodeMetadata } from "@/types/workflow";

// Calculate node dimensions based on actual DOM measurements or stored bounds
const calculateNodeDimensions = (
  metadata: NodeMetadata,
  nodeBounds?: Map<string, { x: number; y: number; width: number; height: number }>
): { width: number; height: number } => {
  // First, try to use stored bounds if available
  if (nodeBounds && nodeBounds.has(metadata.id)) {
    const bounds = nodeBounds.get(metadata.id)!;
    return { width: bounds.width, height: bounds.height };
  }
  
  // Otherwise, try to get actual DOM measurements from the draggable node
  const nodeElement = document.querySelector(`[data-node-id="${metadata.id}"]`);
  if (nodeElement) {
    const rect = nodeElement.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }
  
  // Fallback to default dimensions if element not found
  return { width: 200, height: 100 };
};

interface NodeGroupContainerProps {
  group: NodeGroup;
  children: React.ReactNode;
  isCollapsed: boolean;
  onCollapseToggle: (groupId: string) => void;
  isDropTarget?: boolean;
  onEditClick?: (groupId: string) => void;
  onDeleteClick?: (groupId: string) => void;
  zoom?: number;
  nodePositions?: Record<string, { x: number; y: number }>; // Local node positions
  nodeBounds?: Map<string, { x: number; y: number; width: number; height: number }>; // Node bounds from useNodeBounds hook
}

export function NodeGroupContainer({
  group,
  children,
  isCollapsed,
  onCollapseToggle,
  isDropTarget = false,
  onEditClick,
  onDeleteClick,
  zoom = 1,
  nodePositions = {},
  nodeBounds,
}: NodeGroupContainerProps) {
  // Memoize group data to prevent unnecessary re-renders
  const groupId = group?.id;
  const groupPosition = group?.position;
  const groupSize = group?.size;
  // Use local isCollapsed prop instead of synced group.isCollapsed
  const groupDescription = group?.description;
  const groupTitle = group?.title;
  const groupColor = group?.color;
  const groupNodeIds = group?.nodeIds || [];

  // All hooks must be declared before any early returns
  const lastValidPosition = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [localPosition, setLocalPosition] = useState<{ x: number; y: number } | null>(null);
  const [isContainerReady, setIsContainerReady] = useState(false);
  const lastUpdateTime = useRef<number>(0);
  const finalPosition = useRef<{ x: number; y: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; initialGroupX: number; initialGroupY: number } | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hideConnectionLines, setHideConnectionLines] = useState(false);
  
  const { updateGroup, updateGroupBounds, updateNodePosition, nodes, currentGraphId, setGraphDirty } = useWorkflowStore();
  
  // Update last valid position when we get a good one
  useEffect(() => {
    if (groupPosition && typeof groupPosition.x === 'number' && typeof groupPosition.y === 'number') {
      lastValidPosition.current = { ...groupPosition };
    }
  }, [groupPosition?.x, groupPosition?.y]);
  
  // Debug logging to track prop changes

  // Ensure group has required properties before rendering
  if (!groupId) {
    console.error('🔷GROUPOPS RENDER-ERROR: Group has no ID, not rendering', group);
    return null;
  }
  
  // Additional validation with warnings instead of returning null
  if (!groupPosition || !groupSize) {
    console.warn('🔷GROUPOPS RENDER-WARNING: Group missing position or size, using defaults', {
      id: groupId,
      hasPosition: !!groupPosition,
      hasSize: !!groupSize,
      position: groupPosition,
      size: groupSize
    });
  }
  
  // Extra validation for position values
  if (groupPosition && (typeof groupPosition.x !== 'number' || typeof groupPosition.y !== 'number')) {
    console.warn('🔷GROUPOPS RENDER-WARNING: Group position has invalid values, using defaults', {
      id: groupId,
      position: groupPosition,
      xType: typeof groupPosition?.x,
      yType: typeof groupPosition?.y
    });
  }

  // Mark container as ready once it's mounted and positioned
  useEffect(() => {
    // Mark as ready once mounted
    setIsContainerReady(true);
  }, []);
  
  // Clear local position when group props change from CRDT, but only if not actively dragging
  useEffect(() => {
    if (!isDragging && !isResizing && localPosition && groupPosition) {
      // Check if CRDT position is significantly different from our local position
      const deltaX = Math.abs((groupPosition.x || 0) - localPosition.x);
      const deltaY = Math.abs((groupPosition.y || 0) - localPosition.y);
      
      // If CRDT position is different (tolerance for floating point), sync to it
      if (deltaX > 1 || deltaY > 1) {
        // console.log removed
        // Clear local position to use CRDT position
        setLocalPosition(null);
      }
    }
  }, [groupPosition?.x, groupPosition?.y, isDragging, isResizing, localPosition, groupId]);
  
  // Store dragging state in a data attribute so child nodes can detect it
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.setAttribute('data-group-dragging', isDragging.toString());
    }
  }, [isDragging]);

  // Handle group dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Check if we clicked on a button or interactive element first
    if (target.tagName === "BUTTON" || target.closest("button")) {
      return;
    }

    // Since this handler is on the header div, we know we're in the header area
    // No need to check for .group-header class
    e.preventDefault();
    e.stopPropagation(); // Prevent canvas selection
    
    setIsDragging(true);
    setHideConnectionLines(true); // Hide connection lines during drag
    
    // Use current visual position (localPosition if active, otherwise CRDT position)
    const currentX = localPosition?.x ?? groupPosition?.x ?? 0;
    const currentY = localPosition?.y ?? groupPosition?.y ?? 0;
    
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      initialGroupX: currentX,
      initialGroupY: currentY,
    });
  };

  const handleMouseUp = useCallback(() => {
    // Force a final position update to CRDT
    if (isDragging && finalPosition.current && dragStart) {
      try {
        // Update group bounds (position) - this will also update member node absolute positions
        updateGroupBounds(groupId, { x: finalPosition.current.x, y: finalPosition.current.y });
        
        setGraphDirty(currentGraphId, true);
        finalPosition.current = null; // Clear the stored position
      } catch (error) {
        console.error('Error updating group bounds:', error);
      }
    }
    
    setIsDragging(false);
    setIsResizing(false);
    setDragStart(null);
    setResizeStart(null);
    
    // Don't clear local position immediately - let the sync detection handle it

    // Re-enable connection lines after a brief delay to allow DOM to update
    setTimeout(() => {
      setHideConnectionLines(false);

      // Trigger port position re-measurement for all nodes in this group
      const groupMoveEvent = new CustomEvent("groupPositionChanged", {
        bubbles: true,
        detail: { groupId: groupId },
      });
      if (containerRef.current) {
        containerRef.current.dispatchEvent(groupMoveEvent);
      }
    }, 50);
  }, [groupId, isDragging, isResizing, dragStart, updateGroupBounds, currentGraphId, setGraphDirty]);

  // Handle resize from bottom-right corner
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // console.log removed
    setIsResizing(true);
    setHideConnectionLines(true); // Hide connection lines during resize too
    const startSize = {
      width: groupSize?.width || 200,
      height: groupSize?.height || 150,
    };
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      ...startSize
    });
    // console.log removed
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    let animationFrameId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      // Cancel any pending animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // Schedule update on next animation frame for smooth movement
      animationFrameId = requestAnimationFrame(() => {
        if (isDragging && dragStart) {
          const deltaX = (e.clientX - dragStart.x) / zoom;
          const deltaY = (e.clientY - dragStart.y) / zoom;
          const newX = dragStart.initialGroupX + deltaX;
          const newY = dragStart.initialGroupY + deltaY;
          
          // Store the final position for later use
          finalPosition.current = { x: newX, y: newY };
          
          // Update local position immediately for visual feedback
          setLocalPosition({ x: newX, y: newY });
          
          // Don't update CRDT during drag to prevent rubber-band effect
          // Only store the final position for later sync
        }

        if (isResizing && resizeStart) {
          // Calculate minimum size based on member nodes
          const memberNodes = nodes.filter(node => 
            groupNodeIds.includes(node.metadata.id)
          );
          
          let minWidth = 200; // Default minimum
          let minHeight = 150; // Default minimum
          
          if (memberNodes.length > 0) {
            // Find the rightmost and bottommost edges of all nodes
            let maxRight = 0;
            let maxBottom = 0;
            
            memberNodes.forEach(node => {
              const nodeId = node.metadata.id;
              
              // Use local position if available, otherwise calculate from absolute
              let relativeX, relativeY;
              if (nodePositions[nodeId]) {
                relativeX = nodePositions[nodeId].x;
                relativeY = nodePositions[nodeId].y;
              } else {
                // Fallback to calculating from absolute position
                const headerOffset = groupDescription ? 100 : 32;
                relativeX = (node.position?.x || 0) - (groupPosition?.x || 0);
                relativeY = (node.position?.y || 0) - (groupPosition?.y || 0) - headerOffset;
              }
              
              // Get node dimensions based on metadata and stored bounds
              const { width: nodeWidth, height: nodeHeight } = calculateNodeDimensions(node.metadata, nodeBounds);
              
              maxRight = Math.max(maxRight, relativeX + nodeWidth);
              maxBottom = Math.max(maxBottom, relativeY + nodeHeight);
            });
            
            // Add padding (nodes already account for header offset in their positions)
            const padding = 20;
            minWidth = Math.max(200, maxRight + padding);
            minHeight = Math.max(150, maxBottom + padding);
          }
          
          const deltaX = (e.clientX - resizeStart.x) / zoom;
          const deltaY = (e.clientY - resizeStart.y) / zoom;
          
          const newWidth = Math.max(minWidth, resizeStart.width + deltaX);
          const newHeight = Math.max(minHeight, resizeStart.height + deltaY);
          
          // console.log removed
          
          // Throttle resize updates to reduce glitching
          if (resizeTimeoutRef.current) {
            clearTimeout(resizeTimeoutRef.current);
          }
          
          resizeTimeoutRef.current = setTimeout(() => {
            updateGroup(groupId, { size: { width: newWidth, height: newHeight } });
            setGraphDirty(currentGraphId, true);
          }, 16); // ~60fps
        }
      });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDragging,
    isResizing,
    dragStart,
    resizeStart,
    groupId,
    updateGroup,
    handleMouseUp,
    zoom,
    currentGraphId,
    nodes,
    groupPosition?.x,
    groupPosition?.y,
    groupDescription,
  ]);


  // Debug position values before render
  // Use last valid position as fallback to prevent jumps
  const fallbackX = lastValidPosition.current?.x ?? 100;
  const fallbackY = lastValidPosition.current?.y ?? 100;
  const xPos = localPosition?.x ?? groupPosition?.x ?? fallbackX;
  const yPos = localPosition?.y ?? groupPosition?.y ?? fallbackY;
  
  // Log if position is invalid but still render with fallback
  if (!groupPosition || typeof groupPosition.x !== 'number' || typeof groupPosition.y !== 'number') {
    console.warn('🔷GROUPOPS POSITION-WARNING: Group has invalid position, using fallback', {
      groupId: groupId,
      position: groupPosition,
      lastValidPosition: lastValidPosition.current,
      usingPosition: { x: xPos, y: yPos }
    });
  }
  
  // Log when collapsed state changes
  useEffect(() => {
    // console.log removed
  }, [isCollapsed, xPos, yPos, groupId, groupPosition, localPosition]);

  return (
    <div
      ref={containerRef}
      className={`absolute border-2 border-dashed border-gray-400 bg-gray-50/30 rounded-lg pointer-events-auto transition-all duration-200 ${
        isCollapsed ? "border-gray-600 bg-gray-100/50" : ""
      } ${isDragging ? "shadow-2xl border-blue-500" : ""} ${
        isDropTarget && !isCollapsed ? "border-blue-500 bg-blue-50/40 shadow-lg ring-2 ring-blue-300 ring-opacity-50" : ""
      }`}
      style={{
        transform: `translate(${xPos}px, ${yPos}px)`,
        width: Math.max(100, groupSize?.width || 200),
        height: isCollapsed ? 40 : Math.max(80, groupSize?.height || 150),
        zIndex: 0, // Behind nodes
        borderColor: groupColor || "#9CA3AF",
        cursor: isDragging ? "grabbing" : "default",
        willChange: isDragging || isResizing ? 'transform' : 'auto',
        // Ensure visibility
        minWidth: '100px',
        minHeight: isCollapsed ? '40px' : '80px',
      }}
      data-group-container="true"
    >
      {/* Drop Target Indicator */}
      {isDropTarget && !isCollapsed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-blue-500 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg animate-pulse">
            <svg 
              className="w-8 h-8" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={3} 
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Group Header */}
      <div
        className="group-header absolute top-0 left-0 right-0 h-8 bg-white/90 backdrop-blur-sm border-b border-gray-300 rounded-t-lg cursor-move flex items-center justify-between px-3 z-50 pointer-events-auto"
        onMouseDown={handleMouseDown}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEditClick?.(groupId);
        }}
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {groupTitle}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          {/* Edit button */}
          <button
            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onEditClick?.(groupId);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Edit group"
          >
            <Edit2 className="w-3 h-3" />
          </button>

          {/* Delete button */}
          <button
            className="text-gray-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick?.(groupId);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Delete group"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          
          {/* Collapse/Expand button */}
          <button
            className="text-gray-500 hover:text-gray-700 text-xs p-1 rounded hover:bg-gray-100 pointer-events-auto relative z-50"
            onClick={(e) => {
              e.stopPropagation();
              onCollapseToggle(groupId);
              
              // Trigger port position updates after a short delay to ensure the UI has updated
              setTimeout(() => {
                const portUpdateEvent = new CustomEvent("groupCollapseChanged", {
                  bubbles: true,
                  detail: { groupId, isCollapsed: !isCollapsed },
                });
                if (containerRef.current) {
                  containerRef.current.dispatchEvent(portUpdateEvent);
                }
              }, 100);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            title={isCollapsed ? "Expand group" : "Collapse group"}
          >
            {isCollapsed ? "▼" : "▲"}
          </button>

          {/* Node count */}
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
            {groupNodeIds.length}
          </span>
        </div>
      </div>

      {/* Group Content */}

      <>
        {/* Description */}
        {groupDescription && (
          <div className={`absolute top-8 left-0 right-0 px-3 py-2 bg-white/60 backdrop-blur-sm  ${isCollapsed ? 'border-b-2 border-l-2 border-r-2 rounded-b-md border-dashed border-gray-400': 'border-b border-gray-200'}`}>
            <p className="text-xs text-gray-600 line-clamp-2">
              {groupDescription}
            </p>
          </div>
        )}
        {!isCollapsed && (
          <>
            {/* Children nodes will be rendered here by the parent - only when container is ready */}
            <div
              className="absolute left-0 right-0 bottom-0"
              style={{ 
                top: groupDescription ? 100 : 32
              }}
            >
              {isContainerReady ? children : null}
            </div>

            {/* Resize handle */}
            <div
              className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize bg-gray-400/70 hover:bg-blue-500 rounded-tl-md transition-colors z-50"
              onMouseDown={handleResizeMouseDown}
              title="Drag to resize"
            >
              <div className="absolute bottom-1 right-1 w-2 h-2">
                <div className="w-full h-px bg-gray-600"></div>
                <div className="w-px h-full bg-gray-600 ml-1 -mt-px"></div>
              </div>
            </div>
          </>
        )}
      </>
    </div>
  );
}
