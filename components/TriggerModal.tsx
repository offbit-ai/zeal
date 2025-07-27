"use client";

import { useState } from "react";
import {
  X,
  Globe,
  Cable,
  Clock,
  ChevronRight,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { ModalPortal } from "./ModalPortal";
import { CodeEditor } from "./CodeEditor";

interface TriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerConfigured: (trigger: TriggerConfig) => void;
  existingTrigger?: TriggerConfig | null;
}

export type TriggerType = "rest" | "websocket" | "scheduler";

export interface TriggerConfig {
  id: string;
  type: TriggerType;
  name: string;
  description?: string;
  config: RestConfig | WebSocketConfig | SchedulerConfig;
  inputSchema?: string;
  outputSchema?: string;
}

interface RestConfig {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  authentication?: "none" | "bearer" | "apikey" | "basic";
  headers?: Record<string, string>;
}

interface WebSocketConfig {
  event: string;
  namespace?: string;
  authentication?: "none" | "token";
}

interface SchedulerConfig {
  cronExpression?: string;
  interval?: {
    value: number;
    unit: "minutes" | "hours" | "days" | "weeks";
  };
  timezone?: string;
  isOneTime?: boolean;
}

export function TriggerModal({
  isOpen,
  onClose,
  onTriggerConfigured,
  existingTrigger,
}: TriggerModalProps) {
  const [selectedType, setSelectedType] = useState<TriggerType | null>(
    existingTrigger?.type || null
  );
  const [triggerName, setTriggerName] = useState(
    existingTrigger?.name || ""
  );
  const [triggerDescription, setTriggerDescription] = useState(
    existingTrigger?.description || ""
  );
  const [showDescription, setShowDescription] = useState(
    !!existingTrigger?.description
  );

  // REST HTTP config
  const [restMethod, setRestMethod] = useState<RestConfig["method"]>(
    (existingTrigger?.config as RestConfig)?.method || "POST"
  );
  const [restPath, setRestPath] = useState(
    (existingTrigger?.config as RestConfig)?.path || "/webhook"
  );
  const [restAuth, setRestAuth] = useState<RestConfig["authentication"]>(
    (existingTrigger?.config as RestConfig)?.authentication || "none"
  );

  // WebSocket config
  const [wsEvent, setWsEvent] = useState(
    (existingTrigger?.config as WebSocketConfig)?.event || ""
  );
  const [wsNamespace, setWsNamespace] = useState(
    (existingTrigger?.config as WebSocketConfig)?.namespace || ""
  );
  const [wsAuth, setWsAuth] = useState<WebSocketConfig["authentication"]>(
    (existingTrigger?.config as WebSocketConfig)?.authentication || "none"
  );

  // Scheduler config
  const [scheduleMode, setScheduleMode] = useState<"once" | "recurring" | "advanced">(
    (existingTrigger?.config as SchedulerConfig)?.cronExpression
      ? "advanced"
      : "recurring"
  );
  const [runOnceDate, setRunOnceDate] = useState("");
  const [runOnceTime, setRunOnceTime] = useState("");
  const [cronExpression, setCronExpression] = useState(
    (existingTrigger?.config as SchedulerConfig)?.cronExpression || ""
  );
  const [intervalValue, setIntervalValue] = useState(
    (existingTrigger?.config as SchedulerConfig)?.interval?.value || 1
  );
  const [intervalUnit, setIntervalUnit] = useState<
    SchedulerConfig["interval"]["unit"]
  >(
    (existingTrigger?.config as SchedulerConfig)?.interval?.unit || "hours"
  );
  const [timezone, setTimezone] = useState(
    (existingTrigger?.config as SchedulerConfig)?.timezone || "UTC"
  );

  // Schemas
  const [inputSchema, setInputSchema] = useState(
    existingTrigger?.inputSchema || '{\n  "type": "object",\n  "properties": {}\n}'
  );
  const [outputSchema, setOutputSchema] = useState(
    existingTrigger?.outputSchema || '{\n  "type": "object",\n  "properties": {}\n}'
  );

  const resetForm = () => {
    setSelectedType(null);
    setTriggerName("");
    setTriggerDescription("");
    setShowDescription(false);
    setRestMethod("POST");
    setRestPath("/webhook");
    setRestAuth("none");
    setWsEvent("");
    setWsNamespace("");
    setWsAuth("none");
    setScheduleMode("recurring");
    setRunOnceDate("");
    setRunOnceTime("");
    setCronExpression("");
    setIntervalValue(1);
    setIntervalUnit("hours");
    setTimezone("UTC");
    setInputSchema('{\n  "type": "object",\n  "properties": {}\n}');
    setOutputSchema('{\n  "type": "object",\n  "properties": {}\n}');
  };

  const handleClose = () => {
    if (!existingTrigger) {
      resetForm();
    }
    onClose();
  };

  const handleSave = () => {
    if (!selectedType || !triggerName.trim()) return;

    let config: RestConfig | WebSocketConfig | SchedulerConfig;

    switch (selectedType) {
      case "rest":
        config = {
          method: restMethod,
          path: restPath,
          authentication: restAuth,
        };
        break;
      case "websocket":
        config = {
          event: wsEvent,
          namespace: wsNamespace,
          authentication: wsAuth,
        };
        break;
      case "scheduler":
        if (scheduleMode === "once") {
          // Convert date and time to a cron expression for one-time execution
          const dateTime = new Date(`${runOnceDate}T${runOnceTime}`);
          const minutes = dateTime.getMinutes();
          const hours = dateTime.getHours();
          const dayOfMonth = dateTime.getDate();
          const month = dateTime.getMonth() + 1;
          const year = dateTime.getFullYear();
          
          // Special cron expression for one-time execution
          config = {
            cronExpression: `${minutes} ${hours} ${dayOfMonth} ${month} * ${year}`,
            timezone,
            isOneTime: true
          };
        } else if (scheduleMode === "advanced") {
          config = { cronExpression, timezone };
        } else {
          config = { interval: { value: intervalValue, unit: intervalUnit }, timezone };
        }
        break;
    }

    const trigger: TriggerConfig = {
      id: existingTrigger?.id || `trigger_${Date.now()}`,
      type: selectedType,
      name: triggerName,
      description: showDescription ? triggerDescription : undefined,
      config,
      inputSchema,
      outputSchema,
    };

    onTriggerConfigured(trigger);
    handleClose();
  };

  const triggerTypes = [
    {
      type: "rest" as TriggerType,
      icon: Globe,
      title: "REST HTTP",
      description: "Trigger workflow via HTTP endpoint",
      color: "blue",
    },
    {
      type: "websocket" as TriggerType,
      icon: Cable,
      title: "WebSocket",
      description: "Real-time event-based triggers",
      color: "green",
    },
    {
      type: "scheduler" as TriggerType,
      icon: Clock,
      title: "Scheduler",
      description: "Time-based workflow execution",
      color: "purple",
    },
  ];

  return (
    <ModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        />
        <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {existingTrigger ? "Edit Trigger" : "Configure Workflow Trigger"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {existingTrigger
                  ? "Modify your workflow trigger configuration"
                  : "Choose how your workflow will be triggered"}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedType && !existingTrigger ? (
              // Trigger type selection
              <div className="grid grid-cols-3 gap-4">
                {triggerTypes.map((trigger) => (
                  <button
                    key={trigger.type}
                    onClick={() => setSelectedType(trigger.type)}
                    className="group p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-all"
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div
                        className={`p-4 bg-${trigger.color}-100 rounded-full group-hover:bg-${trigger.color}-200 transition-colors`}
                      >
                        <trigger.icon
                          className={`w-8 h-8 text-${trigger.color}-600`}
                        />
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-gray-900">
                          {trigger.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {trigger.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              // Configuration form
              <div className="space-y-6">
                {!existingTrigger && (
                  <div className="flex items-center gap-4 mb-6">
                    <button
                      onClick={() => setSelectedType(null)}
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      ← Back
                    </button>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Configure{" "}
                      {triggerTypes.find((t) => t.type === selectedType)?.title}{" "}
                      Trigger
                    </h3>
                  </div>
                )}

                {/* Common fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trigger Name
                  </label>
                  <input
                    type="text"
                    value={triggerName}
                    onChange={(e) => setTriggerName(e.target.value)}
                    placeholder="My Workflow Trigger"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Collapsible Description */}
                <div>
                  <button
                    onClick={() => setShowDescription(!showDescription)}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-2"
                  >
                    {showDescription ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    Add a description
                  </button>
                  {showDescription && (
                    <textarea
                      value={triggerDescription}
                      onChange={(e) => setTriggerDescription(e.target.value)}
                      placeholder="Describe what this trigger does..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>

                {/* Type-specific configuration */}
                {selectedType === "rest" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          HTTP Method
                        </label>
                        <select
                          value={restMethod}
                          onChange={(e) =>
                            setRestMethod(e.target.value as RestConfig["method"])
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                          <option value="PATCH">PATCH</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Endpoint Path
                        </label>
                        <input
                          type="text"
                          value={restPath}
                          onChange={(e) => setRestPath(e.target.value)}
                          placeholder="/api/webhook"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Authentication
                      </label>
                      <select
                        value={restAuth}
                        onChange={(e) =>
                          setRestAuth(
                            e.target.value as RestConfig["authentication"]
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="none">None</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="apikey">API Key</option>
                        <option value="basic">Basic Auth</option>
                      </select>
                    </div>
                  </div>
                )}

                {selectedType === "websocket" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Name
                      </label>
                      <input
                        type="text"
                        value={wsEvent}
                        onChange={(e) => setWsEvent(e.target.value)}
                        placeholder="workflow:trigger"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Namespace (Optional)
                      </label>
                      <input
                        type="text"
                        value={wsNamespace}
                        onChange={(e) => setWsNamespace(e.target.value)}
                        placeholder="/workflows"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Authentication
                      </label>
                      <select
                        value={wsAuth}
                        onChange={(e) =>
                          setWsAuth(
                            e.target.value as WebSocketConfig["authentication"]
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="none">None</option>
                        <option value="token">Token</option>
                      </select>
                    </div>
                  </div>
                )}

                {selectedType === "scheduler" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        When to run
                      </label>
                      <div className="space-y-2">
                        <button
                          onClick={() => setScheduleMode("once")}
                          className={`w-full text-left px-4 py-3 rounded-md border-2 transition-all ${
                            scheduleMode === "once"
                              ? "border-purple-500 bg-purple-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="font-medium text-gray-900">Run once</div>
                          <div className="text-sm text-gray-500">Schedule a one-time execution</div>
                        </button>
                        <button
                          onClick={() => setScheduleMode("recurring")}
                          className={`w-full text-left px-4 py-3 rounded-md border-2 transition-all ${
                            scheduleMode === "recurring"
                              ? "border-purple-500 bg-purple-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="font-medium text-gray-900">Run repeatedly</div>
                          <div className="text-sm text-gray-500">Set up a recurring schedule</div>
                        </button>
                        <button
                          onClick={() => setScheduleMode("advanced")}
                          className={`w-full text-left px-4 py-3 rounded-md border-2 transition-all ${
                            scheduleMode === "advanced"
                              ? "border-purple-500 bg-purple-50 text-purple-700"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="font-medium text-gray-900">Advanced</div>
                          <div className="text-sm text-gray-500">Use cron expression for complex schedules</div>
                        </button>
                      </div>
                    </div>

                    {scheduleMode === "once" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Date
                            </label>
                            <input
                              type="date"
                              value={runOnceDate}
                              onChange={(e) => setRunOnceDate(e.target.value)}
                              min={new Date().toISOString().split('T')[0]}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Time
                            </label>
                            <input
                              type="time"
                              value={runOnceTime}
                              onChange={(e) => setRunOnceTime(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {scheduleMode === "recurring" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Quick options
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: "Every 5 minutes", value: 5, unit: "minutes" },
                              { label: "Every 30 minutes", value: 30, unit: "minutes" },
                              { label: "Every hour", value: 1, unit: "hours" },
                              { label: "Every 6 hours", value: 6, unit: "hours" },
                              { label: "Daily", value: 1, unit: "days" },
                              { label: "Weekly", value: 1, unit: "weeks" },
                            ].map((option) => (
                              <button
                                key={`${option.value}-${option.unit}`}
                                onClick={() => {
                                  setIntervalValue(option.value);
                                  setIntervalUnit(option.unit as SchedulerConfig["interval"]["unit"]);
                                }}
                                className={`px-3 py-2 text-sm rounded-md border transition-all ${
                                  intervalValue === option.value && intervalUnit === option.unit
                                    ? "border-purple-500 bg-purple-50 text-purple-700"
                                    : "border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-gray-300" />
                          </div>
                          <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-white text-gray-500">Or set custom interval</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Every
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={intervalValue}
                              onChange={(e) =>
                                setIntervalValue(parseInt(e.target.value))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Unit
                            </label>
                            <select
                              value={intervalUnit}
                              onChange={(e) =>
                                setIntervalUnit(
                                  e.target.value as SchedulerConfig["interval"]["unit"]
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="minutes">Minutes</option>
                              <option value="hours">Hours</option>
                              <option value="days">Days</option>
                              <option value="weeks">Weeks</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {scheduleMode === "advanced" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Cron Expression
                        </label>
                        <input
                          type="text"
                          value={cronExpression}
                          onChange={(e) => setCronExpression(e.target.value)}
                          placeholder="0 0 * * *"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                        <div className="mt-2 text-xs text-gray-500 space-y-1">
                          <p>Examples:</p>
                          <p className="font-mono">0 0 * * * - Daily at midnight</p>
                          <p className="font-mono">0 9 * * 1-5 - Weekdays at 9 AM</p>
                          <p className="font-mono">0 */2 * * * - Every 2 hours</p>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Timezone
                      </label>
                      <input
                        type="text"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        placeholder="UTC"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Schema Configuration */}
                <div className="space-y-4 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Schema Configuration
                  </h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Input Schema (JSON Schema)
                    </label>
                    <div className="border border-gray-300 rounded-md overflow-hidden">
                      <CodeEditor
                        value={inputSchema}
                        onChange={setInputSchema}
                        language="json"
                        height={200}
                        placeholder='{\n  "type": "object",\n  "properties": {}\n}'
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Output Schema (JSON Schema)
                    </label>
                    <div className="border border-gray-300 rounded-md overflow-hidden">
                      <CodeEditor
                        value={outputSchema}
                        onChange={setOutputSchema}
                        language="json"
                        height={200}
                        placeholder='{\n  "type": "object",\n  "properties": {}\n}'
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {(selectedType || existingTrigger) && (
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={
                  !triggerName.trim() ||
                  (selectedType === "websocket" && !wsEvent.trim()) ||
                  (selectedType === "scheduler" &&
                    ((scheduleMode === "advanced" && !cronExpression.trim()) ||
                     (scheduleMode === "once" && (!runOnceDate || !runOnceTime))))
                }
                className={`px-6 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                  !triggerName.trim() ||
                  (selectedType === "websocket" && !wsEvent.trim()) ||
                  (selectedType === "scheduler" &&
                    ((scheduleMode === "advanced" && !cronExpression.trim()) ||
                     (scheduleMode === "once" && (!runOnceDate || !runOnceTime))))
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {existingTrigger ? "Update Trigger" : "Save Trigger"}
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}