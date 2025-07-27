"use client";

import React, { useState } from "react";
import { Zap, Edit2, Trash2, AlertCircle, Globe, Cable, Clock } from "lucide-react";
import { TriggerModal, TriggerConfig } from "./TriggerModal";
import { useWorkflowStore } from "@/store/workflowStore";
import { ModalPortal } from "./ModalPortal";

export function TriggerManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<TriggerConfig | null>(
    null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { workflowTrigger, setWorkflowTrigger } = useWorkflowStore();

  const handleTriggerConfigured = (trigger: TriggerConfig) => {
    setWorkflowTrigger(trigger);
    setEditingTrigger(null);
  };

  const handleEdit = () => {
    if (workflowTrigger) {
      setEditingTrigger(workflowTrigger);
      setIsModalOpen(true);
    }
  };

  const handleDelete = () => {
    setWorkflowTrigger(null);
    setShowDeleteConfirm(false);
  };

  const getTriggerIcon = () => {
    if (!workflowTrigger) return Zap;
    
    switch (workflowTrigger.type) {
      case "rest":
        return Globe;
      case "websocket":
        return Cable;
      case "scheduler":
        return Clock;
      default:
        return Zap;
    }
  };

  const getTriggerDescription = () => {
    if (!workflowTrigger) return "No trigger configured";
    
    switch (workflowTrigger.type) {
      case "rest":
        const restConfig = workflowTrigger.config as any;
        return `${restConfig.method} ${restConfig.path}`;
      case "websocket":
        const wsConfig = workflowTrigger.config as any;
        return `Event: ${wsConfig.event}`;
      case "scheduler":
        const schedConfig = workflowTrigger.config as any;
        if (schedConfig.cronExpression) {
          return `Cron: ${schedConfig.cronExpression}`;
        } else {
          return `Every ${schedConfig.interval.value} ${schedConfig.interval.unit}`;
        }
      default:
        return workflowTrigger.name;
    }
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed left-4 top-56 z-20">
        <div className="relative group">
          <button
            onClick={() => setIsModalOpen(true)}
            className={`p-3 rounded-lg shadow-lg transition-all transform hover:scale-105 ${
              workflowTrigger
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-800 hover:bg-gray-900"
            }`}
            title={workflowTrigger ? "Edit Trigger" : "Configure Trigger"}
          >
            {workflowTrigger ? (
              React.createElement(getTriggerIcon(), { className: "w-5 h-5 text-white" })
            ) : (
              <Zap className="w-5 h-5 text-white" />
            )}
          </button>

          {/* Hover Details */}
          {workflowTrigger && (
            <div className="absolute left-full ml-2 top-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
              <div className="bg-white rounded-lg shadow-xl p-3 min-w-[200px]">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-gray-900 text-sm">
                    {workflowTrigger.name}
                  </h4>
                </div>
                <p className="text-xs text-gray-500">{getTriggerDescription()}</p>
                {workflowTrigger.description && (
                  <p className="text-xs text-gray-400 mt-1">
                    {workflowTrigger.description}
                  </p>
                )}
                <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit();
                    }}
                    className="p-1 hover:bg-gray-100 rounded text-gray-600"
                    title="Edit trigger"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(true);
                    }}
                    className="p-1 hover:bg-red-50 rounded text-red-600"
                    title="Delete trigger"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status Indicator */}
        {workflowTrigger && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
        )}
      </div>

      {/* Trigger Modal */}
      <TriggerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTrigger(null);
        }}
        onTriggerConfigured={handleTriggerConfigured}
        existingTrigger={editingTrigger}
      />

      {/* Delete Confirmation */}
      <ModalPortal isOpen={showDeleteConfirm}>
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Trigger
                </h3>
                <p className="text-sm text-gray-500">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete the trigger "{workflowTrigger?.name}"?
              The workflow will no longer have an automated trigger.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
              >
                Delete Trigger
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
    </>
  );
}