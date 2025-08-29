package com.offbit.zeal.subscription;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.offbit.zeal.api.WebhooksAPI;
import com.offbit.zeal.events.ZipEvent;
import com.offbit.zeal.exceptions.ZealException;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.AbstractHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * Webhook subscription manager for receiving webhook events.
 */
public class WebhookSubscription {
    private static final Logger logger = LoggerFactory.getLogger(WebhookSubscription.class);
    
    private final WebhooksAPI webhooksAPI;
    private final SubscriptionOptions options;
    private final ObjectMapper objectMapper;
    private Server server;
    private String webhookId;
    private volatile boolean isRunning = false;
    
    // Event handling
    private final List<Consumer<ZipEvent>> eventCallbacks = new CopyOnWriteArrayList<>();
    private final List<Consumer<WebhookDelivery>> deliveryCallbacks = new CopyOnWriteArrayList<>();
    private final List<Consumer<Exception>> errorCallbacks = new CopyOnWriteArrayList<>();
    private final BlockingQueue<ZipEvent> eventQueue;
    private final ExecutorService eventProcessor;
    
    // Observable support
    private final WebhookObservable observable;

    public WebhookSubscription(WebhooksAPI webhooksAPI, SubscriptionOptions options) {
        this.webhooksAPI = webhooksAPI;
        this.options = options != null ? options : new SubscriptionOptions();
        this.objectMapper = webhooksAPI.getClient().getObjectMapper();
        this.eventQueue = new LinkedBlockingQueue<>(this.options.getBufferSize());
        this.eventProcessor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "webhook-event-processor");
            t.setDaemon(true);
            return t;
        });
        this.observable = new WebhookObservable(this);
        
        // Start event processor
        startEventProcessor();
    }

    /**
     * Subscribe to webhook events.
     */
    public Runnable onEvent(Consumer<ZipEvent> callback) {
        eventCallbacks.add(callback);
        return () -> eventCallbacks.remove(callback);
    }

    /**
     * Subscribe to webhook events of a specific type.
     */
    public <T extends ZipEvent> Runnable onEvent(Class<T> eventType, Consumer<T> callback) {
        Consumer<ZipEvent> wrappedCallback = event -> {
            if (eventType.isInstance(event)) {
                callback.accept(eventType.cast(event));
            }
        };
        return onEvent(wrappedCallback);
    }

    /**
     * Subscribe to webhook deliveries.
     */
    public Runnable onDelivery(Consumer<WebhookDelivery> callback) {
        deliveryCallbacks.add(callback);
        return () -> deliveryCallbacks.remove(callback);
    }

    /**
     * Subscribe to errors.
     */
    public Runnable onError(Consumer<Exception> callback) {
        errorCallbacks.add(callback);
        return () -> errorCallbacks.remove(callback);
    }

    /**
     * Get the observable interface.
     */
    public WebhookObservable asObservable() {
        return observable;
    }

    /**
     * Start the webhook server.
     */
    public synchronized void start() throws ZealException {
        if (isRunning) {
            throw new ZealException("Webhook subscription is already running");
        }
        
        try {
            // Create and start Jetty server
            server = new Server(options.getPort());
            server.setHandler(new WebhookHandler());
            server.start();
            
            isRunning = true;
            logger.info("Webhook server started on {}:{}{}", 
                options.getHost(), options.getPort(), options.getPath());
            
            // Auto-register if enabled
            if (options.isAutoRegister()) {
                CompletableFuture.runAsync(() -> {
                    try {
                        Thread.sleep(200); // Small delay to ensure server is ready
                        register();
                    } catch (Exception e) {
                        emitError(new ZealException("Failed to auto-register webhook", e));
                    }
                });
            }
        } catch (Exception e) {
            throw new ZealException("Failed to start webhook server", e);
        }
    }

    /**
     * Stop the webhook server.
     */
    public synchronized void stop() throws ZealException {
        if (!isRunning) {
            return;
        }
        
        try {
            // Unregister webhook if registered
            if (webhookId != null) {
                try {
                    webhooksAPI.delete(webhookId);
                    logger.info("Unregistered webhook {}", webhookId);
                } catch (Exception e) {
                    logger.error("Failed to unregister webhook {}", webhookId, e);
                }
                webhookId = null;
            }
            
            // Stop server
            if (server != null) {
                server.stop();
                server.join();
                server = null;
            }
            
            isRunning = false;
            logger.info("Webhook server stopped");
            
            // Shutdown event processor
            eventProcessor.shutdown();
            try {
                if (!eventProcessor.awaitTermination(5, TimeUnit.SECONDS)) {
                    eventProcessor.shutdownNow();
                }
            } catch (InterruptedException e) {
                eventProcessor.shutdownNow();
                Thread.currentThread().interrupt();
            }
        } catch (Exception e) {
            throw new ZealException("Failed to stop webhook server", e);
        }
    }

    /**
     * Register the webhook with Zeal.
     */
    public void register() throws ZealException {
        if (!isRunning) {
            throw new ZealException("Webhook server must be running before registration");
        }
        
        String protocol = options.isHttps() ? "https" : "http";
        String host = "0.0.0.0".equals(options.getHost()) ? "localhost" : options.getHost();
        String webhookUrl = String.format("%s://%s:%d%s", 
            protocol, host, options.getPort(), options.getPath());
        
        Map<String, Object> request = new HashMap<>();
        request.put("url", webhookUrl);
        request.put("events", options.getEvents());
        request.put("headers", options.getHeaders());
        
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = (Map<String, Object>) webhooksAPI.create(request);
            @SuppressWarnings("unchecked")
            Map<String, Object> subscription = (Map<String, Object>) response.get("subscription");
            webhookId = (String) subscription.get("id");
            logger.info("Registered webhook {} at {}", webhookId, webhookUrl);
        } catch (Exception e) {
            throw new ZealException("Failed to register webhook", e);
        }
    }

    /**
     * Check if the subscription is running.
     */
    public boolean isRunning() {
        return isRunning;
    }

    /**
     * Get the webhook ID if registered.
     */
    public String getWebhookId() {
        return webhookId;
    }

    /**
     * Subscribe to specific event types.
     */
    public Runnable onEventType(List<String> eventTypes, Consumer<ZipEvent> callback) {
        Set<String> typeSet = new HashSet<>(eventTypes);
        return onEvent(event -> {
            if (typeSet.contains(event.getType())) {
                callback.accept(event);
            }
        });
    }

    /**
     * Subscribe to events from specific sources.
     */
    public Runnable onEventSource(List<String> sources, Consumer<ZipEvent> callback) {
        Set<String> sourceSet = new HashSet<>(sources);
        return onEvent(event -> {
            if (sourceSet.contains(event.getWorkflowId())) {
                callback.accept(event);
            }
        });
    }

    /**
     * Filter events based on a predicate.
     */
    public WebhookObservable filterEvents(Predicate<ZipEvent> predicate) {
        return observable.filter(predicate);
    }

    /**
     * Process a webhook delivery.
     */
    private void processDelivery(WebhookDelivery delivery) {
        // Notify delivery callbacks
        for (Consumer<WebhookDelivery> callback : deliveryCallbacks) {
            try {
                callback.accept(delivery);
            } catch (Exception e) {
                logger.error("Error in delivery callback", e);
                emitError(e);
            }
        }
        
        // Process individual events
        for (Map<String, Object> eventData : delivery.getEvents()) {
            try {
                ZipEvent event = objectMapper.convertValue(eventData, ZipEvent.class);
                
                // Add to queue for processing
                if (!eventQueue.offer(event)) {
                    logger.warn("Event queue is full, dropping event");
                }
                
                // Emit to observable
                observable.emit(event);
            } catch (Exception e) {
                logger.error("Failed to parse event", e);
                emitError(e);
            }
        }
    }

    /**
     * Start the event processor thread.
     */
    private void startEventProcessor() {
        eventProcessor.execute(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    ZipEvent event = eventQueue.take();
                    
                    // Process event callbacks
                    for (Consumer<ZipEvent> callback : eventCallbacks) {
                        try {
                            callback.accept(event);
                        } catch (Exception e) {
                            logger.error("Error in event callback", e);
                            emitError(e);
                        }
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        });
    }

    /**
     * Emit an error to all error callbacks.
     */
    private void emitError(Exception error) {
        for (Consumer<Exception> callback : errorCallbacks) {
            try {
                callback.accept(error);
            } catch (Exception e) {
                logger.error("Error in error callback", e);
            }
        }
        observable.error(error);
    }

    /**
     * Verify webhook signature.
     */
    private boolean verifySignature(byte[] body, String signature) {
        if (!options.isVerifySignature() || options.getSecretKey() == null) {
            return true;
        }
        
        if (signature == null || !signature.startsWith("sha256=")) {
            return false;
        }
        
        String expectedSig = signature.substring(7);
        
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(
                options.getSecretKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            byte[] hash = mac.doFinal(body);
            String calculatedSig = bytesToHex(hash);
            return expectedSig.equals(calculatedSig);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            logger.error("Failed to verify signature", e);
            return false;
        }
    }

    /**
     * Convert bytes to hex string.
     */
    private String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }

    /**
     * Jetty handler for webhook requests.
     */
    private class WebhookHandler extends AbstractHandler {
        @Override
        public void handle(String target, org.eclipse.jetty.server.Request baseRequest,
                          HttpServletRequest request, HttpServletResponse response) 
                          throws IOException {
            
            if (!options.getPath().equals(target) || !"POST".equals(request.getMethod())) {
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                baseRequest.setHandled(true);
                return;
            }
            
            try {
                // Read request body
                String body = request.getReader().lines().collect(Collectors.joining("\n"));
                byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
                
                // Verify signature if enabled
                if (options.isVerifySignature()) {
                    String signature = request.getHeader("X-Zeal-Signature");
                    if (!verifySignature(bodyBytes, signature)) {
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        response.getWriter().write("Invalid signature");
                        baseRequest.setHandled(true);
                        return;
                    }
                }
                
                // Parse delivery
                WebhookDelivery delivery = objectMapper.readValue(body, WebhookDelivery.class);
                
                // Process asynchronously
                CompletableFuture.runAsync(() -> processDelivery(delivery));
                
                // Send success response
                response.setStatus(HttpServletResponse.SC_OK);
                response.getWriter().write("OK");
            } catch (Exception e) {
                logger.error("Error processing webhook", e);
                emitError(e);
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                response.getWriter().write("Internal server error");
            }
            
            baseRequest.setHandled(true);
        }
    }
}