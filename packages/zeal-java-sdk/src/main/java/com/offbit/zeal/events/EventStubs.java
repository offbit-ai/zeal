package com.offbit.zeal.events;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

// Node events
class NodeFailedEvent extends ZipEvent {
    @JsonProperty("nodeId")
    private String nodeId;
    @JsonProperty("error")
    private Map<String, Object> error;
    
    public NodeFailedEvent() { super("node.failed"); }
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public Map<String, Object> getError() { return error; }
    public void setError(Map<String, Object> error) { this.error = error; }
}

class NodeWarningEvent extends ZipEvent {
    @JsonProperty("nodeId")
    private String nodeId;
    @JsonProperty("warning")
    private Map<String, Object> warning;
    
    public NodeWarningEvent() { super("node.warning"); }
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public Map<String, Object> getWarning() { return warning; }
    public void setWarning(Map<String, Object> warning) { this.warning = warning; }
}

class NodeUpdatedEvent extends ZipEvent {
    @JsonProperty("nodeId")
    private String nodeId;
    @JsonProperty("data")
    private Map<String, Object> data;
    
    public NodeUpdatedEvent() { super("node.updated"); }
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public Map<String, Object> getData() { return data; }
    public void setData(Map<String, Object> data) { this.data = data; }
}

class NodeDeletedEvent extends ZipEvent {
    @JsonProperty("nodeId")
    private String nodeId;
    
    public NodeDeletedEvent() { super("node.deleted"); }
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
}

// Execution events
class ExecutionStartedEvent extends ZipEvent {
    @JsonProperty("sessionId")
    private String sessionId;
    @JsonProperty("workflowName")
    private String workflowName;
    
    public ExecutionStartedEvent() { super("execution.started"); }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public String getWorkflowName() { return workflowName; }
    public void setWorkflowName(String workflowName) { this.workflowName = workflowName; }
}

class ExecutionCompletedEvent extends ZipEvent {
    @JsonProperty("sessionId")
    private String sessionId;
    @JsonProperty("duration")
    private Long duration;
    @JsonProperty("nodesExecuted")
    private Integer nodesExecuted;
    
    public ExecutionCompletedEvent() { super("execution.completed"); }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public Long getDuration() { return duration; }
    public void setDuration(Long duration) { this.duration = duration; }
    public Integer getNodesExecuted() { return nodesExecuted; }
    public void setNodesExecuted(Integer nodesExecuted) { this.nodesExecuted = nodesExecuted; }
}

class ExecutionFailedEvent extends ZipEvent {
    @JsonProperty("sessionId")
    private String sessionId;
    @JsonProperty("error")
    private Map<String, Object> error;
    
    public ExecutionFailedEvent() { super("execution.failed"); }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public Map<String, Object> getError() { return error; }
    public void setError(Map<String, Object> error) { this.error = error; }
}

// Workflow events
class WorkflowCreatedEvent extends ZipEvent {
    @JsonProperty("workflowName")
    private String workflowName;
    @JsonProperty("userId")
    private String userId;
    
    public WorkflowCreatedEvent() { super("workflow.created"); }
    public String getWorkflowName() { return workflowName; }
    public void setWorkflowName(String workflowName) { this.workflowName = workflowName; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
}

class WorkflowUpdatedEvent extends ZipEvent {
    @JsonProperty("data")
    private Map<String, Object> data;
    
    public WorkflowUpdatedEvent() { super("workflow.updated"); }
    public Map<String, Object> getData() { return data; }
    public void setData(Map<String, Object> data) { this.data = data; }
}

class WorkflowDeletedEvent extends ZipEvent {
    @JsonProperty("workflowName")
    private String workflowName;
    
    public WorkflowDeletedEvent() { super("workflow.deleted"); }
    public String getWorkflowName() { return workflowName; }
    public void setWorkflowName(String workflowName) { this.workflowName = workflowName; }
}

// Connection events
class ConnectionAddedEvent extends ZipEvent {
    @JsonProperty("data")
    private Map<String, Object> data;
    
    public ConnectionAddedEvent() { super("connection.added"); }
    public Map<String, Object> getData() { return data; }
    public void setData(Map<String, Object> data) { this.data = data; }
}

class ConnectionDeletedEvent extends ZipEvent {
    @JsonProperty("data")
    private Map<String, Object> data;
    
    public ConnectionDeletedEvent() { super("connection.deleted"); }
    public Map<String, Object> getData() { return data; }
    public void setData(Map<String, Object> data) { this.data = data; }
}

// Group events
class GroupCreatedEvent extends ZipEvent {
    @JsonProperty("data")
    private Map<String, Object> data;
    
    public GroupCreatedEvent() { super("group.created"); }
    public Map<String, Object> getData() { return data; }
    public void setData(Map<String, Object> data) { this.data = data; }
}

class GroupUpdatedEvent extends ZipEvent {
    @JsonProperty("data")
    private Map<String, Object> data;
    
    public GroupUpdatedEvent() { super("group.updated"); }
    public Map<String, Object> getData() { return data; }
    public void setData(Map<String, Object> data) { this.data = data; }
}

class GroupDeletedEvent extends ZipEvent {
    @JsonProperty("data")
    private Map<String, Object> data;

    public GroupDeletedEvent() { super("group.deleted"); }
    public Map<String, Object> getData() { return data; }
    public void setData(Map<String, Object> data) { this.data = data; }
}

// Stream events
class StreamOpenedEvent extends ZipEvent {
    @JsonProperty("nodeId")
    private String nodeId;
    @JsonProperty("port")
    private String port;
    @JsonProperty("streamId")
    private Long streamId;
    @JsonProperty("contentType")
    private String contentType;
    @JsonProperty("sizeHint")
    private Long sizeHint;

    public StreamOpenedEvent() { super("stream.opened"); }
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public String getPort() { return port; }
    public void setPort(String port) { this.port = port; }
    public Long getStreamId() { return streamId; }
    public void setStreamId(Long streamId) { this.streamId = streamId; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public Long getSizeHint() { return sizeHint; }
    public void setSizeHint(Long sizeHint) { this.sizeHint = sizeHint; }
}

class StreamClosedEvent extends ZipEvent {
    @JsonProperty("nodeId")
    private String nodeId;
    @JsonProperty("streamId")
    private Long streamId;
    @JsonProperty("totalBytes")
    private Long totalBytes;

    public StreamClosedEvent() { super("stream.closed"); }
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public Long getStreamId() { return streamId; }
    public void setStreamId(Long streamId) { this.streamId = streamId; }
    public Long getTotalBytes() { return totalBytes; }
    public void setTotalBytes(Long totalBytes) { this.totalBytes = totalBytes; }
}

class StreamErrorEvent extends ZipEvent {
    @JsonProperty("nodeId")
    private String nodeId;
    @JsonProperty("streamId")
    private Long streamId;
    @JsonProperty("error")
    private String error;

    public StreamErrorEvent() { super("stream.error"); }
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public Long getStreamId() { return streamId; }
    public void setStreamId(Long streamId) { this.streamId = streamId; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}