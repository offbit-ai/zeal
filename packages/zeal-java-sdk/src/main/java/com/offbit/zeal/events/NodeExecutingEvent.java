package com.offbit.zeal.events;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Event emitted when a node starts executing.
 */
public class NodeExecutingEvent extends ZipEvent {
    @JsonProperty("nodeId")
    private String nodeId;
    
    @JsonProperty("inputConnections")
    private List<String> inputConnections;

    public NodeExecutingEvent() {
        super("node.executing");
    }

    public String getNodeId() {
        return nodeId;
    }

    public void setNodeId(String nodeId) {
        this.nodeId = nodeId;
    }

    public List<String> getInputConnections() {
        return inputConnections;
    }

    public void setInputConnections(List<String> inputConnections) {
        this.inputConnections = inputConnections;
    }

    @Override
    public String toString() {
        return "NodeExecutingEvent{" +
                "nodeId='" + nodeId + '\'' +
                ", workflowId='" + getWorkflowId() + '\'' +
                ", timestamp='" + getTimestamp() + '\'' +
                '}';
    }
}