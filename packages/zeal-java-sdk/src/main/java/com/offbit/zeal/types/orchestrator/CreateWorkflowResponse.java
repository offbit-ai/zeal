package com.offbit.zeal.types.orchestrator;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

/**
 * Response from creating a workflow.
 */
public class CreateWorkflowResponse {
    @JsonProperty("workflowId")
    private String workflowId;
    
    @JsonProperty("name")
    private String name;
    
    @JsonProperty("version")
    private int version;
    
    @JsonProperty("graphId")
    private String graphId;
    
    @JsonProperty("metadata")
    private Map<String, Object> metadata;

    public String getWorkflowId() {
        return workflowId;
    }

    public void setWorkflowId(String workflowId) {
        this.workflowId = workflowId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
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

    @Override
    public String toString() {
        return "CreateWorkflowResponse{" +
                "workflowId='" + workflowId + '\'' +
                ", name='" + name + '\'' +
                ", version=" + version +
                ", graphId='" + graphId + '\'' +
                '}';
    }
}