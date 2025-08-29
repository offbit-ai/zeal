package zeal

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

// TokenSubject contains subject information required by zeal-auth
type TokenSubject struct {
	ID             string                 `json:"id"`
	Type           string                 `json:"type,omitempty"` // user, service, api_key
	TenantID       string                 `json:"tenant_id,omitempty"`
	OrganizationID string                 `json:"organization_id,omitempty"`
	Teams          []string               `json:"teams,omitempty"`
	Groups         []string               `json:"groups,omitempty"`
	Roles          []string               `json:"roles,omitempty"`
	Permissions    []string               `json:"permissions,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// TokenOptions contains token generation options
type TokenOptions struct {
	ExpiresIn  int      `json:"expires_in,omitempty"`  // seconds
	Issuer     string   `json:"issuer,omitempty"`
	Audience   []string `json:"audience,omitempty"`
	NotBefore  int64    `json:"not_before,omitempty"` // timestamp
	SecretKey  string   `json:"secret_key,omitempty"` // ZEAL_SECRET_KEY for signing
}

// TokenPayload represents the token payload structure expected by zeal-auth
type TokenPayload struct {
	Sub            string                 `json:"sub"`
	Iss            string                 `json:"iss,omitempty"`
	Aud            []string               `json:"aud,omitempty"`
	Exp            int64                  `json:"exp,omitempty"`
	Iat            int64                  `json:"iat,omitempty"`
	Nbf            int64                  `json:"nbf,omitempty"`
	Type           string                 `json:"type,omitempty"`
	TenantID       string                 `json:"tenant_id,omitempty"`
	OrganizationID string                 `json:"organization_id,omitempty"`
	Teams          []string               `json:"teams,omitempty"`
	Groups         []string               `json:"groups,omitempty"`
	Roles          []string               `json:"roles,omitempty"`
	Permissions    []string               `json:"permissions,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	SDKVersion     string                 `json:"sdk_version,omitempty"`
	ApplicationID  string                 `json:"application_id,omitempty"`
	SessionID      string                 `json:"session_id,omitempty"`
}

// GenerateAuthToken generates a signed token for self-hosted Zeal integrators
// Uses HMAC-SHA256 for signing with the provided secret key
// Returns signed token string in format: base64(payload).signature
func GenerateAuthToken(subject *TokenSubject, options *TokenOptions) (string, error) {
	if subject == nil {
		return "", errors.New("subject is required")
	}

	if options == nil {
		options = &TokenOptions{}
	}

	// Get secret key from options or environment
	secretKey := options.SecretKey
	if secretKey == "" {
		secretKey = os.Getenv("ZEAL_SECRET_KEY")
	}
	if secretKey == "" {
		return "", errors.New("ZEAL_SECRET_KEY is required for token generation. Set it as an environment variable or pass it in options")
	}

	now := time.Now().Unix()

	// Generate session ID
	sessionBytes := make([]byte, 8)
	rand.Read(sessionBytes)
	sessionID := hex.EncodeToString(sessionBytes)

	payload := TokenPayload{
		Sub:            subject.ID,
		Iat:            now,
		Type:           subject.Type,
		TenantID:       subject.TenantID,
		OrganizationID: subject.OrganizationID,
		Teams:          subject.Teams,
		Groups:         subject.Groups,
		Roles:          subject.Roles,
		Permissions:    subject.Permissions,
		Metadata:       subject.Metadata,
		SDKVersion:     "1.0.0",
		ApplicationID:  "zeal-go-sdk",
		SessionID:      sessionID,
	}

	// Add optional claims
	if options.ExpiresIn > 0 {
		payload.Exp = now + int64(options.ExpiresIn)
	}
	if options.Issuer != "" {
		payload.Iss = options.Issuer
	}
	if len(options.Audience) > 0 {
		payload.Aud = options.Audience
	}
	if options.NotBefore > 0 {
		payload.Nbf = options.NotBefore
	}

	// Encode payload as base64url
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payload: %w", err)
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(payloadBytes)

	// Create HMAC signature
	h := hmac.New(sha256.New, []byte(secretKey))
	h.Write([]byte(encodedPayload))
	signature := base64.RawURLEncoding.EncodeToString(h.Sum(nil))

	// Return token in format: payload.signature
	return encodedPayload + "." + signature, nil
}

// VerifyAndParseToken verifies and parses a signed token
// Returns parsed token payload or error if invalid
func VerifyAndParseToken(token string, secretKey string) (*TokenPayload, error) {
	if secretKey == "" {
		secretKey = os.Getenv("ZEAL_SECRET_KEY")
	}
	if secretKey == "" {
		return nil, errors.New("ZEAL_SECRET_KEY is required for token verification")
	}

	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return nil, errors.New("invalid token format")
	}

	encodedPayload := parts[0]
	signature := parts[1]

	// Verify signature
	h := hmac.New(sha256.New, []byte(secretKey))
	h.Write([]byte(encodedPayload))
	expectedSignature := base64.RawURLEncoding.EncodeToString(h.Sum(nil))

	if signature != expectedSignature {
		return nil, errors.New("invalid token signature")
	}

	// Decode and parse payload
	payloadBytes, err := base64.RawURLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return nil, fmt.Errorf("failed to decode payload: %w", err)
	}

	var payload TokenPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	return &payload, nil
}

// ParseTokenUnsafe parses a token without verification (USE WITH CAUTION)
// Only use this for debugging or when you don't have the secret key
func ParseTokenUnsafe(token string) (*TokenPayload, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return nil, errors.New("invalid token format")
	}

	encodedPayload := parts[0]

	payloadBytes, err := base64.RawURLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return nil, fmt.Errorf("failed to decode payload: %w", err)
	}

	var payload TokenPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	return &payload, nil
}

// CreateServiceToken creates a service account token
// Convenience function for creating tokens for service-to-service auth
func CreateServiceToken(serviceID, tenantID string, permissions []string, options *TokenOptions) (string, error) {
	return GenerateAuthToken(&TokenSubject{
		ID:          serviceID,
		Type:        "service",
		TenantID:    tenantID,
		Permissions: permissions,
		Metadata: map[string]interface{}{
			"service":    true,
			"created_at": time.Now().UTC().Format(time.RFC3339),
		},
	}, options)
}

// CreateUserToken creates a user token
// Convenience function for creating user authentication tokens
func CreateUserToken(userID, tenantID string, roles []string, options *TokenOptions) (string, error) {
	return GenerateAuthToken(&TokenSubject{
		ID:       userID,
		Type:     "user",
		TenantID: tenantID,
		Roles:    roles,
		Metadata: map[string]interface{}{
			"created_at": time.Now().UTC().Format(time.RFC3339),
		},
	}, options)
}

// CreateAPIKeyToken creates an API key token
// Convenience function for creating API key authentication tokens
func CreateAPIKeyToken(apiKeyID, tenantID string, permissions []string, options *TokenOptions) (string, error) {
	return GenerateAuthToken(&TokenSubject{
		ID:          apiKeyID,
		Type:        "api_key",
		TenantID:    tenantID,
		Permissions: permissions,
		Metadata: map[string]interface{}{
			"api_key":    true,
			"created_at": time.Now().UTC().Format(time.RFC3339),
		},
	}, options)
}

// IsTokenValid validates token expiration and signature
// Returns true if token is valid and not expired, false otherwise
func IsTokenValid(token string, secretKey string) bool {
	payload, err := VerifyAndParseToken(token, secretKey)
	if err != nil {
		return false
	}

	now := time.Now().Unix()

	// Check expiration
	if payload.Exp > 0 && payload.Exp < now {
		return false
	}

	// Check not before
	if payload.Nbf > 0 && payload.Nbf > now {
		return false
	}

	return true
}