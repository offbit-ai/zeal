"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { NodeGroup } from "@/types/workflow";
import { useWorkflowStore } from "@/store/workflowStore";
import { useGraphStore } from "@/store/graphStore";
import { Edit2, Trash2 } from "lucide-react";

interface NodeGroupContainerProps {
  group: NodeGroup;
  children: React.ReactNode;
  isDropTarget?: boolean;
  onEditClick?: (groupId: string) => void;
  onDeleteClick?: (groupId: string) => void;
  zoom?: number;
}

export function NodeGroupContainer({
  group,
  children,
  isDropTarget = false,
  onEditClick,
  onDeleteClick,
  zoom = 1,
}: NodeGroupContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const { moveGroup, resizeGroup, updateGroup, setGroupDragging } =
    useWorkflowStore();
  const { currentGraphId, setGraphDirty } = useGraphStore();

  // Handle group dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Check if the click is within the header area
    const clickedElement = target.closest(".group-header");
    if (!clickedElement) return;

    // Check if we clicked on a button or interactive element
    if (target.tagName === "BUTTON" || target.closest("button")) {
      return;
    }

    e.preventDefault();
    e.stopPropagation(); // Prevent canvas selection
    setIsDragging(true);
    setGroupDragging(true); // Hide connection lines during drag
    setDragStart({
      x: e.clientX - group.position.x * zoom,
      y: e.clientY - group.position.y * zoom,
    });
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setDragStart(null);
    setResizeStart(null);

    // Re-enable connection lines after a brief delay to allow DOM to update
    setTimeout(() => {
      setGroupDragging(false);

      // Trigger port position re-measurement for all nodes in this group
      const groupMoveEvent = new CustomEvent("groupPositionChanged", {
        bubbles: true,
        detail: { groupId: group.id },
      });
      if (containerRef.current) {
        containerRef.current.dispatchEvent(groupMoveEvent);
      }
    }, 50);
  }, [setGroupDragging]);

  // Handle resize from bottom-right corner
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: group.size.width,
      height: group.size.height,
    });
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
          const newX = (e.clientX - dragStart.x) / zoom;
          const newY = (e.clientY - dragStart.y) / zoom;
          moveGroup(group.id, { x: newX, y: newY });
          setGraphDirty(currentGraphId, true);
        }

        if (isResizing && resizeStart) {
          const newWidth = Math.max(
            200,
            resizeStart.width + (e.clientX - resizeStart.x) / zoom
          );
          const newHeight = Math.max(
            150,
            resizeStart.height + (e.clientY - resizeStart.y) / zoom
          );
          resizeGroup(group.id, { width: newWidth, height: newHeight });
          setGraphDirty(currentGraphId, true);
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
    group.id,
    moveGroup,
    resizeGroup,
    handleMouseUp,
    zoom,
  ]);

  return (
    <div
      ref={containerRef}
      className={`absolute border-2 border-dashed border-gray-400 bg-gray-50/30 rounded-lg pointer-events-auto transition-all duration-200 ${
        group.collapsed ? "border-gray-600" : ""
      } ${isDragging ? "shadow-2xl border-blue-500" : ""} ${
        isDropTarget && !group.collapsed ? "border-blue-500 bg-blue-50/40 shadow-lg ring-2 ring-blue-300 ring-opacity-50" : ""
      }`}
      style={{
        left: group.position.x,
        top: group.position.y,
        width: group.size.width,
        height: group.collapsed ? 40 : group.size.height,
        zIndex: 0, // Behind nodes
        borderColor: group.color || "#9CA3AF",
        cursor: isDragging ? "grabbing" : "default",
      }}
      data-group-container="true"
    >
      {/* Group Header */}
      <div
        className="group-header absolute top-0 left-0 right-0 h-8 bg-white/80 backdrop-blur-sm border-b border-gray-300 rounded-t-lg cursor-move flex items-center justify-between px-3"
        onMouseDown={handleMouseDown}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEditClick?.(group.id);
        }}
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {group.title}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          {/* Edit button */}
          <button
            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onEditClick?.(group.id);
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
              onDeleteClick?.(group.id);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Delete group"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          
          {/* Collapse/Expand button */}
          <button
            className="text-gray-500 hover:text-gray-700 text-xs p-1"
            onClick={(e) => {
              e.stopPropagation();
              updateGroup(group.id, { collapsed: !group.collapsed });
              setGraphDirty(currentGraphId, true);
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {group.collapsed ? "▼" : "▲"}
          </button>

          {/* Node count */}
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
            {group.nodeIds.length}
          </span>
        </div>
      </div>

      {/* Group Content */}

      <>
        {/* Description */}
        {group.description && (
          <div className={`absolute top-8 left-0 right-0 px-3 py-2 bg-white/60 backdrop-blur-sm  ${group.collapsed ? 'border-b-2 border-l-2 border-r-2 rounded-b-md border-dashed border-gray-400': 'border-b border-gray-200'}`}>
            <p className="text-xs text-gray-600 line-clamp-2">
              {group.description}
            </p>
          </div>
        )}
        {!group.collapsed && (
          <>
            {/* Children nodes will be rendered here by the parent */}
            <div
              className="absolute left-0 right-0 bottom-0"
              style={{ top: group.description ? 100 : 32 }}
            >
              {children}
            </div>

            {/* Resize handle */}
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-400/50 hover:bg-gray-500 rounded-tl-md"
              onMouseDown={handleResizeMouseDown}
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
