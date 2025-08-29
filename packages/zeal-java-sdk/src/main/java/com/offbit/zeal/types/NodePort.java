package com.offbit.zeal.types;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Objects;

/**
 * Represents a port on a node for connections.
 */
public class NodePort {
    @JsonProperty("nodeId")
    private String nodeId;
    
    @JsonProperty("portId")
    private String portId;

    public NodePort() {
    }

    public NodePort(String nodeId, String portId) {
        this.nodeId = nodeId;
        this.portId = portId;
    }

    public String getNodeId() {
        return nodeId;
    }

    public void setNodeId(String nodeId) {
        this.nodeId = nodeId;
    }

    public String getPortId() {
        return portId;
    }

    public void setPortId(String portId) {
        this.portId = portId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        NodePort nodePort = (NodePort) o;
        return Objects.equals(nodeId, nodePort.nodeId) && Objects.equals(portId, nodePort.portId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(nodeId, portId);
    }

    @Override
    public String toString() {
        return "NodePort{nodeId='" + nodeId + "', portId='" + portId + "'}";
    }
}