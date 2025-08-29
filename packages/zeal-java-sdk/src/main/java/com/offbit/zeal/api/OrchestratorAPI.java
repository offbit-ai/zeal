package com.offbit.zeal.api;

import com.offbit.zeal.ZealClient;
import com.offbit.zeal.exceptions.ZealException;
import com.offbit.zeal.types.orchestrator.*;
import java.util.concurrent.CompletableFuture;

/**
 * API client for orchestrator operations.
 */
public class OrchestratorAPI {
    private final ZealClient client;
    private static final String BASE_PATH = "/api/zip/orchestrator";

    public OrchestratorAPI(ZealClient client) {
        this.client = client;
    }

    /**
     * Create a new workflow.
     */
    public CreateWorkflowResponse createWorkflow(CreateWorkflowRequest request) throws ZealException {
        return client.makeRequest("POST", BASE_PATH + "/workflows", request, CreateWorkflowResponse.class);
    }

    /**
     * Create a new workflow asynchronously.
     */
    public CompletableFuture<CreateWorkflowResponse> createWorkflowAsync(CreateWorkflowRequest request) {
        return client.makeRequestAsync("POST", BASE_PATH + "/workflows", request, CreateWorkflowResponse.class);
    }

    /**
     * Get workflow by ID.
     */
    public Object getWorkflow(String workflowId) throws ZealException {
        return client.makeRequest("GET", BASE_PATH + "/workflows/" + workflowId, null, Object.class);
    }

    /**
     * List all workflows.
     */
    public Object listWorkflows() throws ZealException {
        return client.makeRequest("GET", BASE_PATH + "/workflows", null, Object.class);
    }

    /**
     * Delete a workflow.
     */
    public void deleteWorkflow(String workflowId) throws ZealException {
        client.makeRequest("DELETE", BASE_PATH + "/workflows/" + workflowId, null, Void.class);
    }

    /**
     * Add a node to a workflow.
     */
    public Object addNode(Object request) throws ZealException {
        return client.makeRequest("POST", BASE_PATH + "/nodes", request, Object.class);
    }

    /**
     * Update a node.
     */
    public Object updateNode(String nodeId, Object request) throws ZealException {
        return client.makeRequest("PUT", BASE_PATH + "/nodes/" + nodeId, request, Object.class);
    }

    /**
     * Delete a node.
     */
    public void deleteNode(String nodeId) throws ZealException {
        client.makeRequest("DELETE", BASE_PATH + "/nodes/" + nodeId, null, Void.class);
    }

    /**
     * Connect two nodes.
     */
    public Object connectNodes(Object request) throws ZealException {
        return client.makeRequest("POST", BASE_PATH + "/connections", request, Object.class);
    }

    /**
     * Remove a connection.
     */
    public void removeConnection(String connectionId) throws ZealException {
        client.makeRequest("DELETE", BASE_PATH + "/connections/" + connectionId, null, Void.class);
    }

    /**
     * Create a group.
     */
    public Object createGroup(Object request) throws ZealException {
        return client.makeRequest("POST", BASE_PATH + "/groups", request, Object.class);
    }

    /**
     * Update a group.
     */
    public Object updateGroup(String groupId, Object request) throws ZealException {
        return client.makeRequest("PUT", BASE_PATH + "/groups/" + groupId, request, Object.class);
    }

    /**
     * Remove a group.
     */
    public void removeGroup(String groupId) throws ZealException {
        client.makeRequest("DELETE", BASE_PATH + "/groups/" + groupId, null, Void.class);
    }
}