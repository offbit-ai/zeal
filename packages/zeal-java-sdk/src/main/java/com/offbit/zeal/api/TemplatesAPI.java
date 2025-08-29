package com.offbit.zeal.api;

import com.offbit.zeal.ZealClient;
import com.offbit.zeal.exceptions.ZealException;
import java.util.concurrent.CompletableFuture;

/**
 * API client for template operations.
 */
public class TemplatesAPI {
    private final ZealClient client;
    private static final String BASE_PATH = "/api/zip/templates";

    public TemplatesAPI(ZealClient client) {
        this.client = client;
    }

    /**
     * Register node templates.
     */
    public Object register(Object request) throws ZealException {
        return client.makeRequest("POST", BASE_PATH, request, Object.class);
    }

    /**
     * Register node templates asynchronously.
     */
    public CompletableFuture<Object> registerAsync(Object request) {
        return client.makeRequestAsync("POST", BASE_PATH, request, Object.class);
    }

    /**
     * List templates by namespace.
     */
    public Object list(String namespace) throws ZealException {
        String path = namespace != null ? BASE_PATH + "?namespace=" + namespace : BASE_PATH;
        return client.makeRequest("GET", path, null, Object.class);
    }

    /**
     * Get template by ID.
     */
    public Object getTemplate(String templateId) throws ZealException {
        return client.makeRequest("GET", BASE_PATH + "/" + templateId, null, Object.class);
    }

    /**
     * Update a template.
     */
    public Object updateTemplate(String templateId, Object template) throws ZealException {
        return client.makeRequest("PUT", BASE_PATH + "/" + templateId, template, Object.class);
    }

    /**
     * Delete a template.
     */
    public void deleteTemplate(String templateId) throws ZealException {
        client.makeRequest("DELETE", BASE_PATH + "/" + templateId, null, Void.class);
    }
}