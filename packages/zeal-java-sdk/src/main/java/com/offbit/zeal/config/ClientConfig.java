package com.offbit.zeal.config;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Configuration for the Zeal SDK client.
 */
public class ClientConfig {
    private String baseUrl;
    private Duration defaultTimeout;
    private boolean verifyTls;
    private String userAgent;
    private int maxRetries;
    private long retryBackoffMs;
    private boolean enableCompression;
    private Map<String, String> defaultHeaders;

    /**
     * Default constructor with standard configuration.
     */
    public ClientConfig() {
        this.baseUrl = "http://localhost:3000";
        this.defaultTimeout = Duration.ofSeconds(30);
        this.verifyTls = true;
        this.userAgent = "zeal-java-sdk/1.0.0";
        this.maxRetries = 3;
        this.retryBackoffMs = 1000;
        this.enableCompression = true;
        this.defaultHeaders = new HashMap<>();
    }

    /**
     * Builder for ClientConfig.
     */
    public static class Builder {
        private final ClientConfig config;

        public Builder() {
            this.config = new ClientConfig();
        }

        public Builder baseUrl(String baseUrl) {
            if (baseUrl == null || baseUrl.isEmpty()) {
                throw new IllegalArgumentException("Base URL cannot be null or empty");
            }
            // Remove trailing slash
            if (baseUrl.endsWith("/")) {
                baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
            }
            config.baseUrl = baseUrl;
            return this;
        }

        public Builder timeout(Duration timeout) {
            if (timeout == null || timeout.isNegative()) {
                throw new IllegalArgumentException("Timeout must be positive");
            }
            config.defaultTimeout = timeout;
            return this;
        }

        public Builder verifyTls(boolean verify) {
            config.verifyTls = verify;
            return this;
        }

        public Builder userAgent(String userAgent) {
            config.userAgent = userAgent;
            return this;
        }

        public Builder maxRetries(int maxRetries) {
            if (maxRetries < 0) {
                throw new IllegalArgumentException("Max retries must be non-negative");
            }
            config.maxRetries = maxRetries;
            return this;
        }

        public Builder retryBackoffMs(long backoffMs) {
            if (backoffMs < 0) {
                throw new IllegalArgumentException("Retry backoff must be non-negative");
            }
            config.retryBackoffMs = backoffMs;
            return this;
        }

        public Builder enableCompression(boolean enable) {
            config.enableCompression = enable;
            return this;
        }

        public Builder addDefaultHeader(String name, String value) {
            config.defaultHeaders.put(name, value);
            return this;
        }

        public Builder defaultHeaders(Map<String, String> headers) {
            if (headers != null) {
                config.defaultHeaders.putAll(headers);
            }
            return this;
        }

        public ClientConfig build() {
            return config;
        }
    }

    /**
     * Create a new builder.
     */
    public static Builder builder() {
        return new Builder();
    }

    // Getters
    public String getBaseUrl() {
        return baseUrl;
    }

    public Duration getDefaultTimeout() {
        return defaultTimeout;
    }

    public boolean isVerifyTls() {
        return verifyTls;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public int getMaxRetries() {
        return maxRetries;
    }

    public long getRetryBackoffMs() {
        return retryBackoffMs;
    }

    public boolean isEnableCompression() {
        return enableCompression;
    }

    public Map<String, String> getDefaultHeaders() {
        return new HashMap<>(defaultHeaders);
    }

    // Setters for direct configuration
    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public void setDefaultTimeout(Duration defaultTimeout) {
        this.defaultTimeout = defaultTimeout;
    }

    public void setVerifyTls(boolean verifyTls) {
        this.verifyTls = verifyTls;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public void setMaxRetries(int maxRetries) {
        this.maxRetries = maxRetries;
    }

    public void setRetryBackoffMs(long retryBackoffMs) {
        this.retryBackoffMs = retryBackoffMs;
    }

    public void setEnableCompression(boolean enableCompression) {
        this.enableCompression = enableCompression;
    }

    public void setDefaultHeaders(Map<String, String> defaultHeaders) {
        this.defaultHeaders = defaultHeaders != null ? new HashMap<>(defaultHeaders) : new HashMap<>();
    }
}