package com.offbit.zeal;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.offbit.zeal.api.*;
import com.offbit.zeal.config.ClientConfig;
import com.offbit.zeal.exceptions.ZealException;
import com.offbit.zeal.subscription.SubscriptionOptions;
import com.offbit.zeal.subscription.WebhookSubscription;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.IOException;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Main client for interacting with the Zeal Integration Protocol.
 */
public class ZealClient {
    private static final Logger logger = LoggerFactory.getLogger(ZealClient.class);
    
    private final ClientConfig config;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    
    private final OrchestratorAPI orchestrator;
    private final TemplatesAPI templates;
    private final TracesAPI traces;
    private final WebhooksAPI webhooks;

    /**
     * Create a new ZealClient with the given configuration.
     */
    public ZealClient(ClientConfig config) throws ZealException {
        if (config == null) {
            throw new IllegalArgumentException("Configuration cannot be null");
        }
        if (config.getBaseUrl() == null || config.getBaseUrl().isEmpty()) {
            throw new IllegalArgumentException("Base URL cannot be null or empty");
        }
        
        this.config = config;
        this.objectMapper = createObjectMapper();
        this.httpClient = createHttpClient();
        
        // Initialize API modules
        this.orchestrator = new OrchestratorAPI(this);
        this.templates = new TemplatesAPI(this);
        this.traces = new TracesAPI(this);
        this.webhooks = new WebhooksAPI(this);
    }

    /**
     * Create a new ZealClient with default configuration.
     */
    public ZealClient() throws ZealException {
        this(new ClientConfig());
    }

    /**
     * Create a new ZealClient with just a base URL.
     */
    public ZealClient(String baseUrl) throws ZealException {
        this(ClientConfig.builder().baseUrl(baseUrl).build());
    }

    /**
     * Create the Jackson ObjectMapper for JSON serialization.
     */
    private ObjectMapper createObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        return mapper;
    }

    /**
     * Create the OkHttp client with configured settings.
     */
    private OkHttpClient createHttpClient() throws ZealException {
        try {
            OkHttpClient.Builder builder = new OkHttpClient.Builder()
                .connectTimeout(config.getDefaultTimeout())
                .readTimeout(config.getDefaultTimeout())
                .writeTimeout(config.getDefaultTimeout())
                .retryOnConnectionFailure(true);

            // Add interceptor for default headers
            builder.addInterceptor(chain -> {
                Request original = chain.request();
                Request.Builder requestBuilder = original.newBuilder()
                    .header("User-Agent", config.getUserAgent())
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json");
                
                // Add any custom default headers
                for (Map.Entry<String, String> header : config.getDefaultHeaders().entrySet()) {
                    requestBuilder.header(header.getKey(), header.getValue());
                }
                
                return chain.proceed(requestBuilder.build());
            });

            // Add retry interceptor
            if (config.getMaxRetries() > 0) {
                builder.addInterceptor(new RetryInterceptor(config.getMaxRetries(), config.getRetryBackoffMs()));
            }

            // Configure SSL/TLS
            if (!config.isVerifyTls()) {
                configureTrustAllCerts(builder);
            }

            return builder.build();
        } catch (Exception e) {
            throw new ZealException("Failed to create HTTP client", e);
        }
    }

    /**
     * Configure the HTTP client to trust all certificates (for development only).
     */
    private void configureTrustAllCerts(OkHttpClient.Builder builder) throws Exception {
        TrustManager[] trustAllCerts = new TrustManager[]{
            new X509TrustManager() {
                public X509Certificate[] getAcceptedIssuers() {
                    return new X509Certificate[0];
                }
                public void checkClientTrusted(X509Certificate[] chain, String authType) {}
                public void checkServerTrusted(X509Certificate[] chain, String authType) {}
            }
        };

        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(null, trustAllCerts, new java.security.SecureRandom());
        builder.sslSocketFactory(sslContext.getSocketFactory(), (X509TrustManager) trustAllCerts[0]);
        builder.hostnameVerifier((hostname, session) -> true);
    }

    /**
     * Make an HTTP request and return the response.
     */
    public <T> T makeRequest(String method, String path, Object body, Class<T> responseClass) throws ZealException {
        String url = config.getBaseUrl() + path;
        
        try {
            Request.Builder requestBuilder = new Request.Builder().url(url);
            
            // Add method and body
            if (body != null) {
                String json = objectMapper.writeValueAsString(body);
                RequestBody requestBody = RequestBody.create(json, MediaType.parse("application/json"));
                requestBuilder.method(method, requestBody);
            } else {
                if ("GET".equals(method) || "HEAD".equals(method)) {
                    requestBuilder.method(method, null);
                } else {
                    requestBuilder.method(method, RequestBody.create("", MediaType.parse("application/json")));
                }
            }
            
            Request request = requestBuilder.build();
            
            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    String errorBody = response.body() != null ? response.body().string() : "";
                    throw new ZealException("Request failed: " + response.message(), response.code(), errorBody);
                }
                
                if (responseClass == Void.class) {
                    return null;
                }
                
                String responseBody = response.body() != null ? response.body().string() : "";
                return objectMapper.readValue(responseBody, responseClass);
            }
        } catch (IOException e) {
            throw new ZealException("Network error: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new ZealException("Request failed: " + e.getMessage(), e);
        }
    }

    /**
     * Make an async HTTP request and return a CompletableFuture.
     */
    public <T> CompletableFuture<T> makeRequestAsync(String method, String path, Object body, Class<T> responseClass) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return makeRequest(method, path, body, responseClass);
            } catch (ZealException e) {
                throw new RuntimeException(e);
            }
        });
    }

    /**
     * Create a webhook subscription.
     */
    public WebhookSubscription createWebhookSubscription(SubscriptionOptions options) {
        return new WebhookSubscription(this.webhooks, options != null ? options : new SubscriptionOptions());
    }

    /**
     * Create a webhook subscription with default options.
     */
    public WebhookSubscription createWebhookSubscription() {
        return createWebhookSubscription(null);
    }

    // Getters for API modules
    public OrchestratorAPI orchestrator() {
        return orchestrator;
    }

    public TemplatesAPI templates() {
        return templates;
    }

    public TracesAPI traces() {
        return traces;
    }

    public WebhooksAPI webhooks() {
        return webhooks;
    }

    public ClientConfig getConfig() {
        return config;
    }

    public ObjectMapper getObjectMapper() {
        return objectMapper;
    }

    /**
     * Retry interceptor for failed requests.
     */
    private static class RetryInterceptor implements Interceptor {
        private final int maxRetries;
        private final long retryBackoffMs;

        RetryInterceptor(int maxRetries, long retryBackoffMs) {
            this.maxRetries = maxRetries;
            this.retryBackoffMs = retryBackoffMs;
        }

        @Override
        public Response intercept(Chain chain) throws IOException {
            Request request = chain.request();
            Response response = null;
            IOException lastException = null;
            
            for (int attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    if (response != null) {
                        response.close();
                    }
                    
                    response = chain.proceed(request);
                    
                    // Only retry on server errors (5xx) or network errors
                    if (response.isSuccessful() || response.code() < 500) {
                        return response;
                    }
                } catch (IOException e) {
                    lastException = e;
                }
                
                // Wait before retrying (exponential backoff)
                if (attempt < maxRetries) {
                    try {
                        long waitTime = retryBackoffMs * (long) Math.pow(2, attempt);
                        Thread.sleep(waitTime);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        throw new IOException("Retry interrupted", e);
                    }
                }
            }
            
            if (lastException != null) {
                throw lastException;
            }
            return response;
        }
    }

    /**
     * Close the client and release resources.
     */
    public void close() {
        httpClient.dispatcher().executorService().shutdown();
        httpClient.connectionPool().evictAll();
    }
}