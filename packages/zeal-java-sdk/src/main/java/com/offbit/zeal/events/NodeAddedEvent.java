package com.offbit.zeal.events;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

/**
 * Event emitted when a node is added to a workflow.
 */
public class NodeAddedEvent extends ZipEvent {
    @JsonProperty("nodeId")
    private String nodeId;
    
    @JsonProperty("data")
    private Map<String, Object> data;

    public NodeAddedEvent() {
        super("node.added");
    }

    public String getNodeId() {
        return nodeId;
    }

    public void setNodeId(String nodeId) {
        this.nodeId = nodeId;
    }

    public Map<String, Object> getData() {
        return data;
    }

    public void setData(Map<String, Object> data) {
        this.data = data;
    }

    @Override
    public String toString() {
        return "NodeAddedEvent{" +
                "nodeId='" + nodeId + '\'' +
                ", workflowId='" + getWorkflowId() + '\'' +
                '}';
    }
}