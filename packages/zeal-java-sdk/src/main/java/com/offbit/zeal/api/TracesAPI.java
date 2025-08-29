package com.offbit.zeal.api;

import com.offbit.zeal.ZealClient;
import com.offbit.zeal.exceptions.ZealException;
import java.util.concurrent.CompletableFuture;

/**
 * API client for trace operations.
 */
public class TracesAPI {
    private final ZealClient client;
    private static final String BASE_PATH = "/api/zip/traces";

    public TracesAPI(ZealClient client) {
        this.client = client;
    }

    /**
     * Create a trace session.
     */
    public Object createSession(Object request) throws ZealException {
        return client.makeRequest("POST", BASE_PATH + "/sessions", request, Object.class);
    }

    /**
     * Create a trace session asynchronously.
     */
    public CompletableFuture<Object> createSessionAsync(Object request) {
        return client.makeRequestAsync("POST", BASE_PATH + "/sessions", request, Object.class);
    }

    /**
     * Submit trace events.
     */
    public Object submitEvents(String sessionId, Object events) throws ZealException {
        return client.makeRequest("POST", BASE_PATH + "/sessions/" + sessionId + "/events", events, Object.class);
    }

    /**
     * Get session by ID.
     */
    public Object getSession(String sessionId) throws ZealException {
        return client.makeRequest("GET", BASE_PATH + "/sessions/" + sessionId, null, Object.class);
    }

    /**
     * Complete a session.
     */
    public Object completeSession(String sessionId, Object request) throws ZealException {
        return client.makeRequest("POST", BASE_PATH + "/sessions/" + sessionId + "/complete", request, Object.class);
    }

    /**
     * Get events for a session.
     */
    public Object getEvents(String sessionId) throws ZealException {
        return client.makeRequest("GET", BASE_PATH + "/sessions/" + sessionId + "/events", null, Object.class);
    }
}