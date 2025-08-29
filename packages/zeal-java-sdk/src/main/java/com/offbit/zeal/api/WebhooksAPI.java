package com.offbit.zeal.api;

import com.offbit.zeal.ZealClient;
import com.offbit.zeal.exceptions.ZealException;
import java.util.concurrent.CompletableFuture;

/**
 * API client for webhook operations.
 */
public class WebhooksAPI {
    private final ZealClient client;
    private static final String BASE_PATH = "/api/zip/webhooks";

    public WebhooksAPI(ZealClient client) {
        this.client = client;
    }

    /**
     * Create a webhook subscription.
     */
    public Object create(Object request) throws ZealException {
        return client.makeRequest("POST", BASE_PATH, request, Object.class);
    }

    /**
     * Create a webhook subscription asynchronously.
     */
    public CompletableFuture<Object> createAsync(Object request) {
        return client.makeRequestAsync("POST", BASE_PATH, request, Object.class);
    }

    /**
     * List all webhooks.
     */
    public Object list() throws ZealException {
        return client.makeRequest("GET", BASE_PATH, null, Object.class);
    }

    /**
     * Get webhook by ID.
     */
    public Object get(String webhookId) throws ZealException {
        return client.makeRequest("GET", BASE_PATH + "/" + webhookId, null, Object.class);
    }

    /**
     * Update a webhook.
     */
    public Object update(String webhookId, Object request) throws ZealException {
        return client.makeRequest("PUT", BASE_PATH + "/" + webhookId, request, Object.class);
    }

    /**
     * Delete a webhook.
     */
    public void delete(String webhookId) throws ZealException {
        client.makeRequest("DELETE", BASE_PATH + "/" + webhookId, null, Void.class);
    }

    /**
     * Test a webhook.
     */
    public Object test(String webhookId) throws ZealException {
        return client.makeRequest("POST", BASE_PATH + "/" + webhookId + "/test", null, Object.class);
    }

    /**
     * Get the associated ZealClient.
     */
    public ZealClient getClient() {
        return client;
    }
}