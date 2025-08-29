package zeal

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// SubscriptionOptions configures webhook subscriptions
type SubscriptionOptions struct {
	Port             int               `json:"port"`
	Host             string            `json:"host"`
	Path             string            `json:"path"`
	HTTPS            bool              `json:"https"`
	Key              string            `json:"key"`
	Cert             string            `json:"cert"`
	AutoRegister     bool              `json:"autoRegister"`
	Namespace        string            `json:"namespace"`
	Events           []string          `json:"events"`
	BufferSize       int               `json:"bufferSize"`
	Headers          map[string]string `json:"headers"`
	VerifySignature  bool              `json:"verifySignature"`
	SecretKey        string            `json:"secretKey"`
}

// DefaultSubscriptionOptions returns default subscription options
func DefaultSubscriptionOptions() SubscriptionOptions {
	return SubscriptionOptions{
		Port:            3001,
		Host:            "0.0.0.0",
		Path:            "/webhooks",
		HTTPS:           false,
		AutoRegister:    true,
		Namespace:       "default",
		Events:          []string{"*"},
		BufferSize:      1000,
		VerifySignature: false,
	}
}

// WebhookDelivery represents a webhook delivery payload
type WebhookDelivery struct {
	WebhookID string                   `json:"webhook_id"`
	Events    []map[string]interface{} `json:"events"`
	Metadata  WebhookMetadata          `json:"metadata"`
}

// WebhookMetadata contains webhook delivery metadata
type WebhookMetadata struct {
	Namespace  string `json:"namespace"`
	DeliveryID string `json:"delivery_id"`
	Timestamp  string `json:"timestamp"`
}

// WebhookEventCallback is called for each webhook event
type WebhookEventCallback func(event map[string]interface{}) error

// WebhookDeliveryCallback is called for each webhook delivery
type WebhookDeliveryCallback func(delivery WebhookDelivery) error

// WebhookErrorCallback is called when an error occurs
type WebhookErrorCallback func(error) error

// WebhookObservable provides an observable interface for webhook events
type WebhookObservable struct {
	eventChan    chan map[string]interface{}
	errorChan    chan error
	completeChan chan struct{}
	subscription *WebhookSubscriptionManager
}

// Subscribe subscribes to webhook events with callbacks
func (wo *WebhookObservable) Subscribe(
	next WebhookEventCallback,
	errorHandler WebhookErrorCallback,
	complete func(),
) func() {
	ctx, cancel := context.WithCancel(context.Background())
	
	go func() {
		for {
			select {
			case event := <-wo.eventChan:
				if err := next(event); err != nil && errorHandler != nil {
					errorHandler(err)
				}
			case err := <-wo.errorChan:
				if errorHandler != nil {
					errorHandler(err)
				}
			case <-wo.completeChan:
				if complete != nil {
					complete()
				}
				return
			case <-ctx.Done():
				return
			}
		}
	}()
	
	return cancel
}

// Filter creates a filtered observable
func (wo *WebhookObservable) Filter(predicate func(map[string]interface{}) bool) *WebhookObservable {
	filtered := &WebhookObservable{
		eventChan:    make(chan map[string]interface{}, wo.subscription.options.BufferSize),
		errorChan:    make(chan error, 10),
		completeChan: make(chan struct{}),
		subscription: wo.subscription,
	}
	
	go func() {
		for {
			select {
			case event := <-wo.eventChan:
				if predicate(event) {
					filtered.eventChan <- event
				}
			case err := <-wo.errorChan:
				filtered.errorChan <- err
			case <-wo.completeChan:
				close(filtered.completeChan)
				return
			}
		}
	}()
	
	return filtered
}

// WebhookSubscriptionManager manages webhook subscriptions
type WebhookSubscriptionManager struct {
	webhooksAPI       *WebhooksAPI
	options           SubscriptionOptions
	server            *http.Server
	eventCallbacks    []WebhookEventCallback
	deliveryCallbacks []WebhookDeliveryCallback
	errorCallbacks    []WebhookErrorCallback
	webhookID         string
	isRunning         bool
	observable        *WebhookObservable
	mu                sync.RWMutex
}

// NewWebhookSubscription creates a new webhook subscription
func NewWebhookSubscription(webhooksAPI *WebhooksAPI, options *SubscriptionOptions) *WebhookSubscriptionManager {
	opts := DefaultSubscriptionOptions()
	if options != nil {
		if options.Port != 0 {
			opts.Port = options.Port
		}
		if options.Host != "" {
			opts.Host = options.Host
		}
		if options.Path != "" {
			opts.Path = options.Path
		}
		opts.HTTPS = options.HTTPS
		if options.Key != "" {
			opts.Key = options.Key
		}
		if options.Cert != "" {
			opts.Cert = options.Cert
		}
		opts.AutoRegister = options.AutoRegister
		if options.Namespace != "" {
			opts.Namespace = options.Namespace
		}
		if len(options.Events) > 0 {
			opts.Events = options.Events
		}
		if options.BufferSize > 0 {
			opts.BufferSize = options.BufferSize
		}
		if options.Headers != nil {
			opts.Headers = options.Headers
		}
		opts.VerifySignature = options.VerifySignature
		if options.SecretKey != "" {
			opts.SecretKey = options.SecretKey
		}
	}
	
	ws := &WebhookSubscriptionManager{
		webhooksAPI: webhooksAPI,
		options:     opts,
		observable: &WebhookObservable{
			eventChan:    make(chan map[string]interface{}, opts.BufferSize),
			errorChan:    make(chan error, 10),
			completeChan: make(chan struct{}),
		},
	}
	ws.observable.subscription = ws
	
	return ws
}

// OnEvent subscribes to webhook events with a callback
func (ws *WebhookSubscriptionManager) OnEvent(callback WebhookEventCallback) func() {
	ws.mu.Lock()
	ws.eventCallbacks = append(ws.eventCallbacks, callback)
	index := len(ws.eventCallbacks) - 1
	ws.mu.Unlock()
	
	return func() {
		ws.mu.Lock()
		defer ws.mu.Unlock()
		if index < len(ws.eventCallbacks) {
			ws.eventCallbacks = append(ws.eventCallbacks[:index], ws.eventCallbacks[index+1:]...)
		}
	}
}

// OnDelivery subscribes to webhook deliveries with a callback
func (ws *WebhookSubscriptionManager) OnDelivery(callback WebhookDeliveryCallback) func() {
	ws.mu.Lock()
	ws.deliveryCallbacks = append(ws.deliveryCallbacks, callback)
	index := len(ws.deliveryCallbacks) - 1
	ws.mu.Unlock()
	
	return func() {
		ws.mu.Lock()
		defer ws.mu.Unlock()
		if index < len(ws.deliveryCallbacks) {
			ws.deliveryCallbacks = append(ws.deliveryCallbacks[:index], ws.deliveryCallbacks[index+1:]...)
		}
	}
}

// OnError subscribes to errors with a callback
func (ws *WebhookSubscriptionManager) OnError(callback WebhookErrorCallback) func() {
	ws.mu.Lock()
	ws.errorCallbacks = append(ws.errorCallbacks, callback)
	index := len(ws.errorCallbacks) - 1
	ws.mu.Unlock()
	
	return func() {
		ws.mu.Lock()
		defer ws.mu.Unlock()
		if index < len(ws.errorCallbacks) {
			ws.errorCallbacks = append(ws.errorCallbacks[:index], ws.errorCallbacks[index+1:]...)
		}
	}
}

// AsObservable returns the observable interface
func (ws *WebhookSubscriptionManager) AsObservable() *WebhookObservable {
	return ws.observable
}

// Start starts the webhook server
func (ws *WebhookSubscriptionManager) Start() error {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	
	if ws.isRunning {
		return fmt.Errorf("webhook subscription is already running")
	}
	
	mux := http.NewServeMux()
	mux.HandleFunc(ws.options.Path, ws.webhookHandler)
	
	addr := fmt.Sprintf("%s:%d", ws.options.Host, ws.options.Port)
	ws.server = &http.Server{
		Addr:    addr,
		Handler: mux,
	}
	
	var err error
	if ws.options.HTTPS && ws.options.Key != "" && ws.options.Cert != "" {
		go func() {
			err = ws.server.ListenAndServeTLS(ws.options.Cert, ws.options.Key)
		}()
	} else {
		go func() {
			err = ws.server.ListenAndServe()
		}()
	}
	
	if err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("failed to start webhook server: %w", err)
	}
	
	// Give the server a moment to start
	time.Sleep(100 * time.Millisecond)
	
	ws.isRunning = true
	fmt.Printf("Webhook server listening on %s%s\n", addr, ws.options.Path)
	
	// Auto-register webhook if enabled
	if ws.options.AutoRegister {
		go func() {
			// Small delay to ensure server is fully started
			time.Sleep(200 * time.Millisecond)
			if err := ws.Register(); err != nil {
				ws.emitError(fmt.Errorf("failed to auto-register webhook: %w", err))
			}
		}()
	}
	
	return nil
}

// Stop stops the webhook server
func (ws *WebhookSubscriptionManager) Stop() error {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	
	if !ws.isRunning {
		return nil
	}
	
	// Unregister webhook if it was registered
	if ws.webhookID != "" {
		if _, err := ws.webhooksAPI.Delete(context.Background(), ws.webhookID); err != nil {
			fmt.Printf("Failed to unregister webhook %s: %v\n", ws.webhookID, err)
		} else {
			fmt.Printf("Unregistered webhook %s\n", ws.webhookID)
		}
		ws.webhookID = ""
	}
	
	// Stop the server
	if ws.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		
		if err := ws.server.Shutdown(ctx); err != nil {
			return fmt.Errorf("failed to shutdown webhook server: %w", err)
		}
		fmt.Println("Webhook server stopped")
	}
	
	ws.isRunning = false
	close(ws.observable.completeChan)
	
	return nil
}

// Register registers the webhook with Zeal
func (ws *WebhookSubscriptionManager) Register() error {
	if !ws.isRunning {
		return fmt.Errorf("webhook server must be running before registration")
	}
	
	// Determine the public URL for the webhook
	protocol := "http"
	if ws.options.HTTPS {
		protocol = "https"
	}
	
	host := ws.options.Host
	if host == "0.0.0.0" {
		host = "localhost"
	}
	
	webhookURL := fmt.Sprintf("%s://%s:%d%s", protocol, host, ws.options.Port, ws.options.Path)
	
	// Register with Zeal
	req := CreateWebhookRequest{
		URL:     webhookURL,
		Events:  ws.options.Events,
		Headers: ws.options.Headers,
	}
	
	result, err := ws.webhooksAPI.Create(context.Background(), req)
	if err != nil {
		return fmt.Errorf("failed to register webhook: %w", err)
	}
	
	ws.webhookID = result.Subscription.ID
	fmt.Printf("Registered webhook %s at %s\n", ws.webhookID, webhookURL)
	
	return nil
}

// IsRunning returns whether the subscription is running
func (ws *WebhookSubscriptionManager) IsRunning() bool {
	ws.mu.RLock()
	defer ws.mu.RUnlock()
	return ws.isRunning
}

// WebhookID returns the current webhook ID if registered
func (ws *WebhookSubscriptionManager) WebhookID() string {
	ws.mu.RLock()
	defer ws.mu.RUnlock()
	return ws.webhookID
}

// OnEventType subscribes to specific event types
func (ws *WebhookSubscriptionManager) OnEventType(eventTypes []string, callback WebhookEventCallback) func() {
	eventTypeSet := make(map[string]bool)
	for _, eventType := range eventTypes {
		eventTypeSet[eventType] = true
	}
	
	filteredCallback := func(event map[string]interface{}) error {
		if eventTypeStr, ok := event["type"].(string); ok {
			if eventTypeSet[eventTypeStr] {
				return callback(event)
			}
		}
		return nil
	}
	
	return ws.OnEvent(filteredCallback)
}

// OnEventSource subscribes to events from specific sources
func (ws *WebhookSubscriptionManager) OnEventSource(sources []string, callback WebhookEventCallback) func() {
	sourceSet := make(map[string]bool)
	for _, source := range sources {
		sourceSet[source] = true
	}
	
	filteredCallback := func(event map[string]interface{}) error {
		if workflowID, ok := event["workflowId"].(string); ok {
			if sourceSet[workflowID] {
				return callback(event)
			}
		}
		return nil
	}
	
	return ws.OnEvent(filteredCallback)
}

// FilterEvents creates a filtered observable
func (ws *WebhookSubscriptionManager) FilterEvents(predicate func(map[string]interface{}) bool) *WebhookObservable {
	return ws.observable.Filter(predicate)
}

func (ws *WebhookSubscriptionManager) webhookHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Read the request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		ws.emitError(fmt.Errorf("failed to read request body: %w", err))
		return
	}
	defer r.Body.Close()
	
	// Verify signature if enabled
	if ws.options.VerifySignature && ws.options.SecretKey != "" {
		signature := r.Header.Get("X-Zeal-Signature")
		if !ws.verifySignature(body, signature) {
			http.Error(w, "Invalid signature", http.StatusUnauthorized)
			ws.emitError(fmt.Errorf("invalid webhook signature"))
			return
		}
	}
	
	// Parse the delivery
	var delivery WebhookDelivery
	if err := json.Unmarshal(body, &delivery); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		ws.emitError(fmt.Errorf("failed to parse webhook delivery: %w", err))
		return
	}
	
	// Process the delivery
	go ws.processDelivery(delivery)
	
	// Send success response
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

func (ws *WebhookSubscriptionManager) processDelivery(delivery WebhookDelivery) {
	// Call delivery callbacks
	ws.mu.RLock()
	deliveryCallbacks := make([]WebhookDeliveryCallback, len(ws.deliveryCallbacks))
	copy(deliveryCallbacks, ws.deliveryCallbacks)
	ws.mu.RUnlock()
	
	for _, callback := range deliveryCallbacks {
		if err := callback(delivery); err != nil {
			ws.emitError(fmt.Errorf("delivery callback error: %w", err))
		}
	}
	
	// Process individual events
	for _, event := range delivery.Events {
		// Send to observable
		select {
		case ws.observable.eventChan <- event:
		default:
			// Channel is full, skip this event
			ws.emitError(fmt.Errorf("event channel is full, skipping event"))
		}
		
		// Call event callbacks
		ws.mu.RLock()
		eventCallbacks := make([]WebhookEventCallback, len(ws.eventCallbacks))
		copy(eventCallbacks, ws.eventCallbacks)
		ws.mu.RUnlock()
		
		for _, callback := range eventCallbacks {
			if err := callback(event); err != nil {
				ws.emitError(fmt.Errorf("event callback error: %w", err))
			}
		}
	}
}

func (ws *WebhookSubscriptionManager) emitError(err error) {
	// Call error callbacks
	ws.mu.RLock()
	errorCallbacks := make([]WebhookErrorCallback, len(ws.errorCallbacks))
	copy(errorCallbacks, ws.errorCallbacks)
	ws.mu.RUnlock()
	
	for _, callback := range errorCallbacks {
		if callbackErr := callback(err); callbackErr != nil {
			fmt.Printf("Error callback failed: %v\n", callbackErr)
		}
	}
	
	// Send to observable
	select {
	case ws.observable.errorChan <- err:
	default:
		// Error channel is full
		fmt.Printf("Error channel is full, error: %v\n", err)
	}
}

func (ws *WebhookSubscriptionManager) verifySignature(body []byte, signature string) bool {
	if ws.options.SecretKey == "" {
		return false
	}
	
	// Parse the signature (format: "sha256=...")
	if !strings.HasPrefix(signature, "sha256=") {
		return false
	}
	
	expectedSig := signature[7:] // Remove "sha256=" prefix
	
	// Calculate HMAC
	mac := hmac.New(sha256.New, []byte(ws.options.SecretKey))
	mac.Write(body)
	calculatedSig := hex.EncodeToString(mac.Sum(nil))
	
	// Compare signatures
	return hmac.Equal([]byte(expectedSig), []byte(calculatedSig))
}

// WebhookConfig represents webhook configuration for registration
type WebhookConfig struct {
	Namespace string            `json:"namespace"`
	URL       string            `json:"url"`
	Events    []string          `json:"events"`
	Headers   map[string]string `json:"headers"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

// WebhookRegistrationResult represents the result of webhook registration
type WebhookRegistrationResult struct {
	WebhookID string `json:"webhookId"`
	URL       string `json:"url"`
}