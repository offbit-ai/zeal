package com.offbit.zeal.events;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Event emitted when a node completes execution successfully.
 */
public class NodeCompletedEvent extends ZipEvent {
    @JsonProperty("nodeId")
    private String nodeId;
    
    @JsonProperty("outputConnections")
    private List<String> outputConnections;
    
    @JsonProperty("duration")
    private Long duration;
    
    @JsonProperty("outputSize")
    private Long outputSize;

    public NodeCompletedEvent() {
        super("node.completed");
    }

    public String getNodeId() {
        return nodeId;
    }

    public void setNodeId(String nodeId) {
        this.nodeId = nodeId;
    }

    public List<String> getOutputConnections() {
        return outputConnections;
    }

    public void setOutputConnections(List<String> outputConnections) {
        this.outputConnections = outputConnections;
    }

    public Long getDuration() {
        return duration;
    }

    public void setDuration(Long duration) {
        this.duration = duration;
    }

    public Long getOutputSize() {
        return outputSize;
    }

    public void setOutputSize(Long outputSize) {
        this.outputSize = outputSize;
    }

    @Override
    public String toString() {
        return "NodeCompletedEvent{" +
                "nodeId='" + nodeId + '\'' +
                ", duration=" + duration +
                ", outputSize=" + outputSize +
                '}';
    }
}