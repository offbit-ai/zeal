package com.offbit.zeal.events;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import java.time.Instant;
import java.util.Map;

/**
 * Base class for all ZIP events.
 */
@JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.EXISTING_PROPERTY,
    property = "type"
)
@JsonSubTypes({
    // Execution events
    @JsonSubTypes.Type(value = NodeExecutingEvent.class, name = "node.executing"),
    @JsonSubTypes.Type(value = NodeCompletedEvent.class, name = "node.completed"),
    @JsonSubTypes.Type(value = NodeFailedEvent.class, name = "node.failed"),
    @JsonSubTypes.Type(value = NodeWarningEvent.class, name = "node.warning"),
    @JsonSubTypes.Type(value = ExecutionStartedEvent.class, name = "execution.started"),
    @JsonSubTypes.Type(value = ExecutionCompletedEvent.class, name = "execution.completed"),
    @JsonSubTypes.Type(value = ExecutionFailedEvent.class, name = "execution.failed"),
    // Workflow events
    @JsonSubTypes.Type(value = WorkflowCreatedEvent.class, name = "workflow.created"),
    @JsonSubTypes.Type(value = WorkflowUpdatedEvent.class, name = "workflow.updated"),
    @JsonSubTypes.Type(value = WorkflowDeletedEvent.class, name = "workflow.deleted"),
    // CRDT events
    @JsonSubTypes.Type(value = NodeAddedEvent.class, name = "node.added"),
    @JsonSubTypes.Type(value = NodeUpdatedEvent.class, name = "node.updated"),
    @JsonSubTypes.Type(value = NodeDeletedEvent.class, name = "node.deleted"),
    @JsonSubTypes.Type(value = ConnectionAddedEvent.class, name = "connection.added"),
    @JsonSubTypes.Type(value = ConnectionDeletedEvent.class, name = "connection.deleted"),
    @JsonSubTypes.Type(value = GroupCreatedEvent.class, name = "group.created"),
    @JsonSubTypes.Type(value = GroupUpdatedEvent.class, name = "group.updated"),
    @JsonSubTypes.Type(value = GroupDeletedEvent.class, name = "group.deleted")
})
public abstract class ZipEvent {
    @JsonProperty("id")
    private String id;
    
    @JsonProperty("type")
    private String type;
    
    @JsonProperty("timestamp")
    private String timestamp;
    
    @JsonProperty("workflowId")
    private String workflowId;
    
    @JsonProperty("graphId")
    private String graphId;
    
    @JsonProperty("metadata")
    private Map<String, Object> metadata;

    public ZipEvent() {
    }

    public ZipEvent(String type) {
        this.type = type;
        this.timestamp = Instant.now().toString();
        this.id = generateEventId();
    }

    /**
     * Generate a unique event ID.
     */
    protected String generateEventId() {
        long timestamp = System.currentTimeMillis();
        String random = Long.toHexString(Double.doubleToLongBits(Math.random())).substring(0, 11);
        return "evt_" + timestamp + "_" + random;
    }

    // Getters and setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public String getWorkflowId() {
        return workflowId;
    }

    public void setWorkflowId(String workflowId) {
        this.workflowId = workflowId;
    }

    public String getGraphId() {
        return graphId;
    }

    public void setGraphId(String graphId) {
        this.graphId = graphId;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }

    /**
     * Check if this is an execution event.
     */
    public boolean isExecutionEvent() {
        return type != null && (
            type.equals("node.executing") ||
            type.equals("node.completed") ||
            type.equals("node.failed") ||
            type.equals("node.warning") ||
            type.startsWith("execution.")
        );
    }

    /**
     * Check if this is a workflow event.
     */
    public boolean isWorkflowEvent() {
        return type != null && type.startsWith("workflow.");
    }

    /**
     * Check if this is a CRDT event.
     */
    public boolean isCRDTEvent() {
        return type != null && (
            type.equals("node.added") ||
            type.equals("node.updated") ||
            type.equals("node.deleted") ||
            type.startsWith("connection.") ||
            type.startsWith("group.") ||
            type.startsWith("template.")
        );
    }

    /**
     * Check if this is a node event.
     */
    public boolean isNodeEvent() {
        return type != null && type.startsWith("node.");
    }

    /**
     * Check if this is a group event.
     */
    public boolean isGroupEvent() {
        return type != null && type.startsWith("group.");
    }

    /**
     * Check if this is a connection event.
     */
    public boolean isConnectionEvent() {
        return type != null && type.startsWith("connection.");
    }
}