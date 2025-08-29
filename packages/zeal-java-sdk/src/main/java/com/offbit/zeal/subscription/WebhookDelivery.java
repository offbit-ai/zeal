package com.offbit.zeal.subscription;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

/**
 * Represents a webhook delivery containing multiple events.
 */
public class WebhookDelivery {
    @JsonProperty("webhook_id")
    private String webhookId;
    
    @JsonProperty("events")
    private List<Map<String, Object>> events;
    
    @JsonProperty("metadata")
    private WebhookMetadata metadata;

    public String getWebhookId() {
        return webhookId;
    }

    public void setWebhookId(String webhookId) {
        this.webhookId = webhookId;
    }

    public List<Map<String, Object>> getEvents() {
        return events;
    }

    public void setEvents(List<Map<String, Object>> events) {
        this.events = events;
    }

    public WebhookMetadata getMetadata() {
        return metadata;
    }

    public void setMetadata(WebhookMetadata metadata) {
        this.metadata = metadata;
    }

    /**
     * Webhook delivery metadata.
     */
    public static class WebhookMetadata {
        @JsonProperty("namespace")
        private String namespace;
        
        @JsonProperty("delivery_id")
        private String deliveryId;
        
        @JsonProperty("timestamp")
        private String timestamp;

        public String getNamespace() {
            return namespace;
        }

        public void setNamespace(String namespace) {
            this.namespace = namespace;
        }

        public String getDeliveryId() {
            return deliveryId;
        }

        public void setDeliveryId(String deliveryId) {
            this.deliveryId = deliveryId;
        }

        public String getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(String timestamp) {
            this.timestamp = timestamp;
        }
    }
}