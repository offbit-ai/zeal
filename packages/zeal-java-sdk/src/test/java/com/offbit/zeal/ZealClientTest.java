package com.offbit.zeal;

import com.offbit.zeal.config.ClientConfig;
import com.offbit.zeal.events.*;
import com.offbit.zeal.exceptions.ZealException;
import com.offbit.zeal.subscription.SubscriptionOptions;
import com.offbit.zeal.subscription.WebhookSubscription;
import com.offbit.zeal.types.Position;
import com.offbit.zeal.types.NodePort;
import com.offbit.zeal.types.orchestrator.CreateWorkflowRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;

import java.time.Duration;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

/**
 * Tests for ZealClient and related functionality.
 */
public class ZealClientTest {

    private ClientConfig config;
    
    @BeforeEach
    void setUp() {
        config = ClientConfig.builder()
            .baseUrl("http://localhost:3000")
            .timeout(Duration.ofSeconds(30))
            .maxRetries(3)
            .build();
    }

    @Test
    @DisplayName("Should create client with valid configuration")
    void testClientCreation() throws ZealException {
        ZealClient client = new ZealClient(config);
        
        assertThat(client).isNotNull();
        assertThat(client.getConfig()).isEqualTo(config);
        assertThat(client.orchestrator()).isNotNull();
        assertThat(client.templates()).isNotNull();
        assertThat(client.traces()).isNotNull();
        assertThat(client.webhooks()).isNotNull();
        
        client.close();
    }

    @Test
    @DisplayName("Should create client with default configuration")
    void testClientCreationDefault() throws ZealException {
        ZealClient client = new ZealClient();
        
        assertThat(client).isNotNull();
        assertThat(client.getConfig().getBaseUrl()).isEqualTo("http://localhost:3000");
        
        client.close();
    }

    @Test
    @DisplayName("Should create client with just base URL")
    void testClientCreationWithUrl() throws ZealException {
        ZealClient client = new ZealClient("http://example.com");
        
        assertThat(client).isNotNull();
        assertThat(client.getConfig().getBaseUrl()).isEqualTo("http://example.com");
        
        client.close();
    }

    @Test
    @DisplayName("Should throw exception for empty base URL")
    void testClientCreationEmptyUrl() {
        ClientConfig invalidConfig = ClientConfig.builder().baseUrl("").build();
        
        assertThatThrownBy(() -> new ZealClient(invalidConfig))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Base URL cannot be");
    }

    @Test
    @DisplayName("Should create webhook subscription")
    void testWebhookSubscriptionCreation() throws ZealException {
        ZealClient client = new ZealClient(config);
        
        SubscriptionOptions options = SubscriptionOptions.builder()
            .port(8080)
            .path("/test")
            .namespace("test-namespace")
            .events(Arrays.asList("node.*", "workflow.*"))
            .build();
        
        WebhookSubscription subscription = client.createWebhookSubscription(options);
        
        assertThat(subscription).isNotNull();
        assertThat(subscription.isRunning()).isFalse();
        
        client.close();
    }

    @Test
    @DisplayName("Should build client config with all options")
    void testClientConfigBuilder() {
        Map<String, String> headers = new HashMap<>();
        headers.put("X-Custom", "value");
        
        ClientConfig config = ClientConfig.builder()
            .baseUrl("https://api.example.com")
            .timeout(Duration.ofSeconds(60))
            .verifyTls(false)
            .userAgent("custom-agent/1.0")
            .maxRetries(5)
            .retryBackoffMs(2000)
            .enableCompression(false)
            .defaultHeaders(headers)
            .build();
        
        assertThat(config.getBaseUrl()).isEqualTo("https://api.example.com");
        assertThat(config.getDefaultTimeout()).isEqualTo(Duration.ofSeconds(60));
        assertThat(config.isVerifyTls()).isFalse();
        assertThat(config.getUserAgent()).isEqualTo("custom-agent/1.0");
        assertThat(config.getMaxRetries()).isEqualTo(5);
        assertThat(config.getRetryBackoffMs()).isEqualTo(2000);
        assertThat(config.isEnableCompression()).isFalse();
        assertThat(config.getDefaultHeaders()).containsEntry("X-Custom", "value");
    }

    @Test
    @DisplayName("Should create Position and NodePort types")
    void testBasicTypes() {
        Position position = new Position(100.5, 200.7);
        assertThat(position.getX()).isEqualTo(100.5);
        assertThat(position.getY()).isEqualTo(200.7);
        
        NodePort port = new NodePort("node-123", "output");
        assertThat(port.getNodeId()).isEqualTo("node-123");
        assertThat(port.getPortId()).isEqualTo("output");
    }

    @Test
    @DisplayName("Should create workflow request with builder")
    void testWorkflowRequestBuilder() {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("author", "test");
        
        CreateWorkflowRequest request = CreateWorkflowRequest.builder()
            .name("Test Workflow")
            .description("A test workflow")
            .metadata(metadata)
            .build();
        
        assertThat(request.getName()).isEqualTo("Test Workflow");
        assertThat(request.getDescription()).isEqualTo("A test workflow");
        assertThat(request.getMetadata()).containsEntry("author", "test");
    }

    @Test
    @DisplayName("Should identify event types correctly")
    void testEventTypeGuards() {
        NodeExecutingEvent execEvent = new NodeExecutingEvent();
        assertThat(execEvent.isExecutionEvent()).isTrue();
        assertThat(execEvent.isNodeEvent()).isTrue();
        assertThat(execEvent.isWorkflowEvent()).isFalse();
        assertThat(execEvent.isCRDTEvent()).isFalse();
        
        NodeAddedEvent addedEvent = new NodeAddedEvent();
        assertThat(addedEvent.isExecutionEvent()).isFalse();
        assertThat(addedEvent.isNodeEvent()).isTrue();
        assertThat(addedEvent.isWorkflowEvent()).isFalse();
        assertThat(addedEvent.isCRDTEvent()).isTrue();
    }

    @Test
    @DisplayName("Should generate unique event IDs")
    void testEventIdGeneration() {
        NodeExecutingEvent event1 = new NodeExecutingEvent();
        NodeExecutingEvent event2 = new NodeExecutingEvent();
        
        assertThat(event1.getId()).isNotNull();
        assertThat(event2.getId()).isNotNull();
        assertThat(event1.getId()).isNotEqualTo(event2.getId());
        assertThat(event1.getId()).startsWith("evt_");
    }

    @Test
    @DisplayName("Should build subscription options")
    void testSubscriptionOptionsBuilder() {
        Map<String, String> headers = new HashMap<>();
        headers.put("Authorization", "Bearer token");
        
        SubscriptionOptions options = SubscriptionOptions.builder()
            .port(9090)
            .host("127.0.0.1")
            .path("/custom-webhooks")
            .https(true)
            .autoRegister(false)
            .namespace("production")
            .events(Arrays.asList("execution.*", "workflow.*"))
            .bufferSize(2000)
            .headers(headers)
            .verifySignature(true)
            .secretKey("my-secret")
            .build();
        
        assertThat(options.getPort()).isEqualTo(9090);
        assertThat(options.getHost()).isEqualTo("127.0.0.1");
        assertThat(options.getPath()).isEqualTo("/custom-webhooks");
        assertThat(options.isHttps()).isTrue();
        assertThat(options.isAutoRegister()).isFalse();
        assertThat(options.getNamespace()).isEqualTo("production");
        assertThat(options.getEvents()).containsExactly("execution.*", "workflow.*");
        assertThat(options.getBufferSize()).isEqualTo(2000);
        assertThat(options.getHeaders()).containsEntry("Authorization", "Bearer token");
        assertThat(options.isVerifySignature()).isTrue();
        assertThat(options.getSecretKey()).isEqualTo("my-secret");
    }
}