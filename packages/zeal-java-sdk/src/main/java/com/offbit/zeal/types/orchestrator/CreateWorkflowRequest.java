package com.offbit.zeal.types.orchestrator;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

/**
 * Request to create a new workflow.
 */
public class CreateWorkflowRequest {
    @JsonProperty("name")
    private String name;
    
    @JsonProperty("description")
    private String description;
    
    @JsonProperty("metadata")
    private Map<String, Object> metadata;

    public CreateWorkflowRequest() {
    }

    public CreateWorkflowRequest(String name) {
        this.name = name;
    }

    public CreateWorkflowRequest(String name, String description) {
        this.name = name;
        this.description = description;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }

    /**
     * Builder for CreateWorkflowRequest.
     */
    public static class Builder {
        private final CreateWorkflowRequest request = new CreateWorkflowRequest();

        public Builder name(String name) {
            request.name = name;
            return this;
        }

        public Builder description(String description) {
            request.description = description;
            return this;
        }

        public Builder metadata(Map<String, Object> metadata) {
            request.metadata = metadata;
            return this;
        }

        public CreateWorkflowRequest build() {
            if (request.name == null || request.name.isEmpty()) {
                throw new IllegalArgumentException("Workflow name is required");
            }
            return request;
        }
    }

    public static Builder builder() {
        return new Builder();
    }
}