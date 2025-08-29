package com.offbit.zeal.subscription;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Options for configuring webhook subscriptions.
 */
public class SubscriptionOptions {
    private int port = 3001;
    private String host = "0.0.0.0";
    private String path = "/webhooks";
    private boolean https = false;
    private String sslKeyPath;
    private String sslCertPath;
    private boolean autoRegister = true;
    private String namespace = "default";
    private List<String> events = new ArrayList<>();
    private int bufferSize = 1000;
    private Map<String, String> headers = new HashMap<>();
    private boolean verifySignature = false;
    private String secretKey;

    public SubscriptionOptions() {
        this.events.add("*");
    }

    // Builder pattern
    public static class Builder {
        private final SubscriptionOptions options = new SubscriptionOptions();

        public Builder port(int port) {
            options.port = port;
            return this;
        }

        public Builder host(String host) {
            options.host = host;
            return this;
        }

        public Builder path(String path) {
            options.path = path;
            return this;
        }

        public Builder https(boolean https) {
            options.https = https;
            return this;
        }

        public Builder sslKeyPath(String keyPath) {
            options.sslKeyPath = keyPath;
            return this;
        }

        public Builder sslCertPath(String certPath) {
            options.sslCertPath = certPath;
            return this;
        }

        public Builder autoRegister(boolean autoRegister) {
            options.autoRegister = autoRegister;
            return this;
        }

        public Builder namespace(String namespace) {
            options.namespace = namespace;
            return this;
        }

        public Builder events(List<String> events) {
            options.events = events != null ? new ArrayList<>(events) : new ArrayList<>();
            return this;
        }

        public Builder addEvent(String event) {
            options.events.add(event);
            return this;
        }

        public Builder bufferSize(int bufferSize) {
            options.bufferSize = bufferSize;
            return this;
        }

        public Builder headers(Map<String, String> headers) {
            options.headers = headers != null ? new HashMap<>(headers) : new HashMap<>();
            return this;
        }

        public Builder addHeader(String name, String value) {
            options.headers.put(name, value);
            return this;
        }

        public Builder verifySignature(boolean verify) {
            options.verifySignature = verify;
            return this;
        }

        public Builder secretKey(String secretKey) {
            options.secretKey = secretKey;
            return this;
        }

        public SubscriptionOptions build() {
            return options;
        }
    }

    public static Builder builder() {
        return new Builder();
    }

    // Getters and setters
    public int getPort() {
        return port;
    }

    public void setPort(int port) {
        this.port = port;
    }

    public String getHost() {
        return host;
    }

    public void setHost(String host) {
        this.host = host;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public boolean isHttps() {
        return https;
    }

    public void setHttps(boolean https) {
        this.https = https;
    }

    public String getSslKeyPath() {
        return sslKeyPath;
    }

    public void setSslKeyPath(String sslKeyPath) {
        this.sslKeyPath = sslKeyPath;
    }

    public String getSslCertPath() {
        return sslCertPath;
    }

    public void setSslCertPath(String sslCertPath) {
        this.sslCertPath = sslCertPath;
    }

    public boolean isAutoRegister() {
        return autoRegister;
    }

    public void setAutoRegister(boolean autoRegister) {
        this.autoRegister = autoRegister;
    }

    public String getNamespace() {
        return namespace;
    }

    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    public List<String> getEvents() {
        return new ArrayList<>(events);
    }

    public void setEvents(List<String> events) {
        this.events = events != null ? new ArrayList<>(events) : new ArrayList<>();
    }

    public int getBufferSize() {
        return bufferSize;
    }

    public void setBufferSize(int bufferSize) {
        this.bufferSize = bufferSize;
    }

    public Map<String, String> getHeaders() {
        return new HashMap<>(headers);
    }

    public void setHeaders(Map<String, String> headers) {
        this.headers = headers != null ? new HashMap<>(headers) : new HashMap<>();
    }

    public boolean isVerifySignature() {
        return verifySignature;
    }

    public void setVerifySignature(boolean verifySignature) {
        this.verifySignature = verifySignature;
    }

    public String getSecretKey() {
        return secretKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }
}