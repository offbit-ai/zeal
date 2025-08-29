package com.zeal.sdk.auth;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

/**
 * Authentication utilities for ZIP SDK
 * Generates auth tokens with the required information for zeal-auth
 */
public class TokenAuth {
    
    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final String SDK_VERSION = "1.0.0";
    private static final String APPLICATION_ID = "zeal-java-sdk";
    private static final ObjectMapper mapper = new ObjectMapper();
    
    /**
     * Subject information required by zeal-auth
     */
    @JsonInclude(Include.NON_NULL)
    public static class TokenSubject {
        public String id;
        @JsonProperty("type")
        public String subjectType; // user, service, api_key
        @JsonProperty("tenant_id")
        public String tenantId;
        @JsonProperty("organization_id")
        public String organizationId;
        public List<String> teams;
        public List<String> groups;
        public List<String> roles;
        public List<String> permissions;
        public Map<String, Object> metadata;
        
        public TokenSubject(String id) {
            this.id = id;
        }
    }
    
    /**
     * Token generation options
     */
    public static class TokenOptions {
        public Integer expiresIn; // seconds
        public String issuer;
        public List<String> audience;
        public Long notBefore; // timestamp
        public String secretKey; // ZEAL_SECRET_KEY for signing
    }
    
    /**
     * Token payload structure expected by zeal-auth
     */
    @JsonInclude(Include.NON_NULL)
    private static class TokenPayload {
        public String sub;
        public String iss;
        public List<String> aud;
        public Long exp;
        public Long iat;
        public Long nbf;
        @JsonProperty("type")
        public String subjectType;
        @JsonProperty("tenant_id")
        public String tenantId;
        @JsonProperty("organization_id")
        public String organizationId;
        public List<String> teams;
        public List<String> groups;
        public List<String> roles;
        public List<String> permissions;
        public Map<String, Object> metadata;
        @JsonProperty("sdk_version")
        public String sdkVersion;
        @JsonProperty("application_id")
        public String applicationId;
        @JsonProperty("session_id")
        public String sessionId;
    }
    
    /**
     * Generate a signed token for self-hosted Zeal integrators
     * Uses HMAC-SHA256 for signing with the provided secret key
     * 
     * @param subject Subject information to include in the token
     * @param options Token generation options (including secretKey)
     * @return Signed token string in format: base64(payload).signature
     * @throws TokenAuthException if token generation fails
     */
    public static String generateAuthToken(TokenSubject subject, TokenOptions options) 
            throws TokenAuthException {
        if (subject == null) {
            throw new TokenAuthException("Subject is required");
        }
        
        if (options == null) {
            options = new TokenOptions();
        }
        
        // Get secret key from options or environment
        String secretKey = options.secretKey;
        if (secretKey == null || secretKey.isEmpty()) {
            secretKey = System.getenv("ZEAL_SECRET_KEY");
        }
        if (secretKey == null || secretKey.isEmpty()) {
            throw new TokenAuthException(
                "ZEAL_SECRET_KEY is required for token generation. " +
                "Set it as an environment variable or pass it in options."
            );
        }
        
        long now = Instant.now().getEpochSecond();
        
        // Generate session ID
        String sessionId = generateSessionId();
        
        TokenPayload payload = new TokenPayload();
        payload.sub = subject.id;
        payload.iat = now;
        payload.subjectType = subject.subjectType;
        payload.tenantId = subject.tenantId;
        payload.organizationId = subject.organizationId;
        payload.teams = subject.teams;
        payload.groups = subject.groups;
        payload.roles = subject.roles;
        payload.permissions = subject.permissions;
        payload.metadata = subject.metadata;
        payload.sdkVersion = SDK_VERSION;
        payload.applicationId = APPLICATION_ID;
        payload.sessionId = sessionId;
        
        // Add optional claims
        if (options.expiresIn != null && options.expiresIn > 0) {
            payload.exp = now + options.expiresIn;
        }
        if (options.issuer != null) {
            payload.iss = options.issuer;
        }
        if (options.audience != null) {
            payload.aud = options.audience;
        }
        if (options.notBefore != null) {
            payload.nbf = options.notBefore;
        }
        
        try {
            // Encode payload as base64url
            String payloadJson = mapper.writeValueAsString(payload);
            String encodedPayload = base64UrlEncode(payloadJson.getBytes(StandardCharsets.UTF_8));
            
            // Create HMAC signature
            Mac mac = Mac.getInstance(HMAC_SHA256);
            SecretKeySpec secretKeySpec = new SecretKeySpec(
                secretKey.getBytes(StandardCharsets.UTF_8), 
                HMAC_SHA256
            );
            mac.init(secretKeySpec);
            byte[] signatureBytes = mac.doFinal(encodedPayload.getBytes(StandardCharsets.UTF_8));
            String signature = base64UrlEncode(signatureBytes);
            
            // Return token in format: payload.signature
            return encodedPayload + "." + signature;
            
        } catch (Exception e) {
            throw new TokenAuthException("Failed to generate token", e);
        }
    }
    
    /**
     * Verify and parse a signed token
     * 
     * @param token Signed token string (payload.signature)
     * @param secretKey Secret key for verification (optional, uses env var if not provided)
     * @return Parsed token payload
     * @throws TokenAuthException if token is invalid or signature doesn't match
     */
    public static Map<String, Object> verifyAndParseToken(String token, String secretKey) 
            throws TokenAuthException {
        if (secretKey == null || secretKey.isEmpty()) {
            secretKey = System.getenv("ZEAL_SECRET_KEY");
        }
        if (secretKey == null || secretKey.isEmpty()) {
            throw new TokenAuthException("ZEAL_SECRET_KEY is required for token verification");
        }
        
        String[] parts = token.split("\\.");
        if (parts.length != 2) {
            throw new TokenAuthException("Invalid token format");
        }
        
        String encodedPayload = parts[0];
        String signature = parts[1];
        
        try {
            // Verify signature
            Mac mac = Mac.getInstance(HMAC_SHA256);
            SecretKeySpec secretKeySpec = new SecretKeySpec(
                secretKey.getBytes(StandardCharsets.UTF_8), 
                HMAC_SHA256
            );
            mac.init(secretKeySpec);
            byte[] expectedSignatureBytes = mac.doFinal(
                encodedPayload.getBytes(StandardCharsets.UTF_8)
            );
            String expectedSignature = base64UrlEncode(expectedSignatureBytes);
            
            if (!signature.equals(expectedSignature)) {
                throw new TokenAuthException("Invalid token signature");
            }
            
            // Decode and parse payload
            byte[] payloadBytes = base64UrlDecode(encodedPayload);
            String payloadJson = new String(payloadBytes, StandardCharsets.UTF_8);
            return mapper.readValue(payloadJson, Map.class);
            
        } catch (TokenAuthException e) {
            throw e;
        } catch (Exception e) {
            throw new TokenAuthException("Failed to verify token", e);
        }
    }
    
    /**
     * Parse a token without verification (USE WITH CAUTION)
     * Only use this for debugging or when you don't have the secret key
     * 
     * @param token Signed token string
     * @return Parsed token payload
     * @throws TokenAuthException if token format is invalid
     */
    public static Map<String, Object> parseTokenUnsafe(String token) throws TokenAuthException {
        String[] parts = token.split("\\.");
        if (parts.length != 2) {
            throw new TokenAuthException("Invalid token format");
        }
        
        String encodedPayload = parts[0];
        
        try {
            byte[] payloadBytes = base64UrlDecode(encodedPayload);
            String payloadJson = new String(payloadBytes, StandardCharsets.UTF_8);
            return mapper.readValue(payloadJson, Map.class);
        } catch (Exception e) {
            throw new TokenAuthException("Invalid token payload", e);
        }
    }
    
    /**
     * Create a service account token
     * Convenience function for creating tokens for service-to-service auth
     * 
     * @param serviceId Service identifier
     * @param tenantId Tenant ID the service belongs to
     * @param permissions Service permissions
     * @param options Token options
     * @return Signed token string
     * @throws TokenAuthException if token generation fails
     */
    public static String createServiceToken(
            String serviceId, 
            String tenantId, 
            List<String> permissions,
            TokenOptions options) throws TokenAuthException {
        
        TokenSubject subject = new TokenSubject(serviceId);
        subject.subjectType = "service";
        subject.tenantId = tenantId;
        subject.permissions = permissions;
        
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("service", true);
        metadata.put("created_at", Instant.now().toString());
        subject.metadata = metadata;
        
        return generateAuthToken(subject, options);
    }
    
    /**
     * Create a user token
     * Convenience function for creating user authentication tokens
     * 
     * @param userId User identifier
     * @param tenantId Tenant ID the user belongs to
     * @param roles User roles
     * @param options Token options
     * @return Signed token string
     * @throws TokenAuthException if token generation fails
     */
    public static String createUserToken(
            String userId,
            String tenantId,
            List<String> roles,
            TokenOptions options) throws TokenAuthException {
        
        TokenSubject subject = new TokenSubject(userId);
        subject.subjectType = "user";
        subject.tenantId = tenantId;
        subject.roles = roles;
        
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("created_at", Instant.now().toString());
        subject.metadata = metadata;
        
        return generateAuthToken(subject, options);
    }
    
    /**
     * Create an API key token
     * Convenience function for creating API key authentication tokens
     * 
     * @param apiKeyId API key identifier
     * @param tenantId Tenant ID the API key belongs to
     * @param permissions API key permissions
     * @param options Token options
     * @return Signed token string
     * @throws TokenAuthException if token generation fails
     */
    public static String createApiKeyToken(
            String apiKeyId,
            String tenantId,
            List<String> permissions,
            TokenOptions options) throws TokenAuthException {
        
        TokenSubject subject = new TokenSubject(apiKeyId);
        subject.subjectType = "api_key";
        subject.tenantId = tenantId;
        subject.permissions = permissions;
        
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("api_key", true);
        metadata.put("created_at", Instant.now().toString());
        subject.metadata = metadata;
        
        return generateAuthToken(subject, options);
    }
    
    /**
     * Validate token expiration and signature
     * 
     * @param token Token to validate
     * @param secretKey Secret key for verification (optional, uses env var if not provided)
     * @return True if token is valid and not expired, false otherwise
     */
    public static boolean isTokenValid(String token, String secretKey) {
        try {
            Map<String, Object> payload = verifyAndParseToken(token, secretKey);
            long now = Instant.now().getEpochSecond();
            
            // Check expiration
            if (payload.containsKey("exp")) {
                long exp = ((Number) payload.get("exp")).longValue();
                if (exp < now) {
                    return false;
                }
            }
            
            // Check not before
            if (payload.containsKey("nbf")) {
                long nbf = ((Number) payload.get("nbf")).longValue();
                if (nbf > now) {
                    return false;
                }
            }
            
            return true;
        } catch (Exception e) {
            return false;
        }
    }
    
    /**
     * Base64 URL encode
     */
    private static String base64UrlEncode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    
    /**
     * Base64 URL decode
     */
    private static byte[] base64UrlDecode(String str) {
        return Base64.getUrlDecoder().decode(str);
    }
    
    /**
     * Generate random session ID
     */
    private static String generateSessionId() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[8];
        random.nextBytes(bytes);
        return bytesToHex(bytes);
    }
    
    /**
     * Convert bytes to hex string
     */
    private static String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }
    
    /**
     * Token authentication exception
     */
    public static class TokenAuthException extends Exception {
        public TokenAuthException(String message) {
            super(message);
        }
        
        public TokenAuthException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}