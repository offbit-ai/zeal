//! Authentication utilities for ZIP SDK
//! Generates auth tokens with the required information for zeal-auth

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use hmac::{Hmac, Mac};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::HashMap;
use std::env;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

/// Subject information required by zeal-auth
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenSubject {
    pub id: String,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub subject_type: Option<String>, // user, service, api_key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub teams: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub groups: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roles: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Token generation options
#[derive(Debug, Clone, Default)]
pub struct TokenOptions {
    pub expires_in: Option<u64>, // seconds
    pub issuer: Option<String>,
    pub audience: Option<Vec<String>>,
    pub not_before: Option<u64>, // timestamp
    pub secret_key: Option<String>, // ZEAL_SECRET_KEY for signing
}

/// Token payload structure expected by zeal-auth
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenPayload {
    pub sub: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iss: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aud: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exp: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iat: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nbf: Option<u64>,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub subject_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub teams: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub groups: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roles: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sdk_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub application_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
}

/// Error type for auth operations
#[derive(Debug)]
pub enum AuthError {
    MissingSecretKey,
    InvalidTokenFormat,
    InvalidSignature,
    InvalidPayload(String),
    SerializationError(String),
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthError::MissingSecretKey => write!(
                f,
                "ZEAL_SECRET_KEY is required for token generation. Set it as an environment variable or pass it in options"
            ),
            AuthError::InvalidTokenFormat => write!(f, "Invalid token format"),
            AuthError::InvalidSignature => write!(f, "Invalid token signature"),
            AuthError::InvalidPayload(msg) => write!(f, "Invalid token payload: {}", msg),
            AuthError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
        }
    }
}

impl std::error::Error for AuthError {}

/// Generate a signed token for self-hosted Zeal integrators
/// Uses HMAC-SHA256 for signing with the provided secret key
/// Returns signed token string in format: base64(payload).signature
pub fn generate_auth_token(
    subject: &TokenSubject,
    options: Option<TokenOptions>,
) -> Result<String, AuthError> {
    let options = options.unwrap_or_default();

    // Get secret key from options or environment
    let secret_key = options
        .secret_key
        .or_else(|| env::var("ZEAL_SECRET_KEY").ok())
        .ok_or(AuthError::MissingSecretKey)?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Generate session ID
    let session_id: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(16)
        .map(char::from)
        .collect();

    let mut payload = TokenPayload {
        sub: subject.id.clone(),
        iat: Some(now),
        subject_type: subject.subject_type.clone(),
        tenant_id: subject.tenant_id.clone(),
        organization_id: subject.organization_id.clone(),
        teams: subject.teams.clone(),
        groups: subject.groups.clone(),
        roles: subject.roles.clone(),
        permissions: subject.permissions.clone(),
        metadata: subject.metadata.clone(),
        sdk_version: Some("1.0.0".to_string()),
        application_id: Some("zeal-rust-sdk".to_string()),
        session_id: Some(session_id),
        iss: None,
        aud: None,
        exp: None,
        nbf: None,
    };

    // Add optional claims
    if let Some(expires_in) = options.expires_in {
        payload.exp = Some(now + expires_in);
    }
    if let Some(issuer) = options.issuer {
        payload.iss = Some(issuer);
    }
    if let Some(audience) = options.audience {
        payload.aud = Some(audience);
    }
    if let Some(not_before) = options.not_before {
        payload.nbf = Some(not_before);
    }

    // Encode payload as base64url
    let payload_json = serde_json::to_string(&payload)
        .map_err(|e| AuthError::SerializationError(e.to_string()))?;
    let encoded_payload = URL_SAFE_NO_PAD.encode(payload_json.as_bytes());

    // Create HMAC signature
    let mut mac = HmacSha256::new_from_slice(secret_key.as_bytes())
        .map_err(|e| AuthError::SerializationError(e.to_string()))?;
    mac.update(encoded_payload.as_bytes());
    let signature = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());

    // Return token in format: payload.signature
    Ok(format!("{}.{}", encoded_payload, signature))
}

/// Verify and parse a signed token
/// Returns parsed token payload or error if invalid
pub fn verify_and_parse_token(
    token: &str,
    secret_key: Option<String>,
) -> Result<TokenPayload, AuthError> {
    let key = secret_key
        .or_else(|| env::var("ZEAL_SECRET_KEY").ok())
        .ok_or(AuthError::MissingSecretKey)?;

    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 2 {
        return Err(AuthError::InvalidTokenFormat);
    }

    let encoded_payload = parts[0];
    let signature = parts[1];

    // Verify signature
    let mut mac = HmacSha256::new_from_slice(key.as_bytes())
        .map_err(|e| AuthError::SerializationError(e.to_string()))?;
    mac.update(encoded_payload.as_bytes());
    let expected_signature = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());

    if signature != expected_signature {
        return Err(AuthError::InvalidSignature);
    }

    // Decode and parse payload
    let payload_bytes = URL_SAFE_NO_PAD
        .decode(encoded_payload)
        .map_err(|e| AuthError::InvalidPayload(e.to_string()))?;
    let payload: TokenPayload = serde_json::from_slice(&payload_bytes)
        .map_err(|e| AuthError::InvalidPayload(e.to_string()))?;

    Ok(payload)
}

/// Parse a token without verification (USE WITH CAUTION)
/// Only use this for debugging or when you don't have the secret key
pub fn parse_token_unsafe(token: &str) -> Result<TokenPayload, AuthError> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 2 {
        return Err(AuthError::InvalidTokenFormat);
    }

    let encoded_payload = parts[0];

    let payload_bytes = URL_SAFE_NO_PAD
        .decode(encoded_payload)
        .map_err(|e| AuthError::InvalidPayload(e.to_string()))?;
    let payload: TokenPayload = serde_json::from_slice(&payload_bytes)
        .map_err(|e| AuthError::InvalidPayload(e.to_string()))?;

    Ok(payload)
}

/// Create a service account token
/// Convenience function for creating tokens for service-to-service auth
pub fn create_service_token(
    service_id: &str,
    tenant_id: &str,
    permissions: Vec<String>,
    options: Option<TokenOptions>,
) -> Result<String, AuthError> {
    let mut metadata = HashMap::new();
    metadata.insert("service".to_string(), serde_json::json!(true));
    metadata.insert(
        "created_at".to_string(),
        serde_json::json!(chrono::Utc::now().to_rfc3339()),
    );

    generate_auth_token(
        &TokenSubject {
            id: service_id.to_string(),
            subject_type: Some("service".to_string()),
            tenant_id: Some(tenant_id.to_string()),
            permissions: Some(permissions),
            metadata: Some(metadata),
            organization_id: None,
            teams: None,
            groups: None,
            roles: None,
        },
        options,
    )
}

/// Create a user token
/// Convenience function for creating user authentication tokens
pub fn create_user_token(
    user_id: &str,
    tenant_id: &str,
    roles: Vec<String>,
    options: Option<TokenOptions>,
) -> Result<String, AuthError> {
    let mut metadata = HashMap::new();
    metadata.insert(
        "created_at".to_string(),
        serde_json::json!(chrono::Utc::now().to_rfc3339()),
    );

    generate_auth_token(
        &TokenSubject {
            id: user_id.to_string(),
            subject_type: Some("user".to_string()),
            tenant_id: Some(tenant_id.to_string()),
            roles: Some(roles),
            metadata: Some(metadata),
            organization_id: None,
            teams: None,
            groups: None,
            permissions: None,
        },
        options,
    )
}

/// Create an API key token
/// Convenience function for creating API key authentication tokens
pub fn create_api_key_token(
    api_key_id: &str,
    tenant_id: &str,
    permissions: Vec<String>,
    options: Option<TokenOptions>,
) -> Result<String, AuthError> {
    let mut metadata = HashMap::new();
    metadata.insert("api_key".to_string(), serde_json::json!(true));
    metadata.insert(
        "created_at".to_string(),
        serde_json::json!(chrono::Utc::now().to_rfc3339()),
    );

    generate_auth_token(
        &TokenSubject {
            id: api_key_id.to_string(),
            subject_type: Some("api_key".to_string()),
            tenant_id: Some(tenant_id.to_string()),
            permissions: Some(permissions),
            metadata: Some(metadata),
            organization_id: None,
            teams: None,
            groups: None,
            roles: None,
        },
        options,
    )
}

/// Validate token expiration and signature
/// Returns true if token is valid and not expired, false otherwise
pub fn is_token_valid(token: &str, secret_key: Option<String>) -> bool {
    match verify_and_parse_token(token, secret_key) {
        Ok(payload) => {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();

            // Check expiration
            if let Some(exp) = payload.exp {
                if exp < now {
                    return false;
                }
            }

            // Check not before
            if let Some(nbf) = payload.nbf {
                if nbf > now {
                    return false;
                }
            }

            true
        }
        Err(_) => false,
    }
}