# Zeal SDK Authentication Implementation Guide

## Consistent Implementation Across All SDKs

All Zeal SDKs follow these principles:
1. **Auth Token Only**: SDKs only collect an auth token from the user
2. **Hardcoded Metadata**: SDK version and application ID are hardcoded internally
3. **Header Only**: Authentication is sent via `Authorization: Bearer <token>` header only

## Configuration Structure

### JavaScript/TypeScript SDK
```typescript
interface ZealClientConfig {
  baseUrl: string
  websocketPath?: string
  authToken?: string  // Only auth field needed
}

// Internally hardcoded:
private static readonly SDK_VERSION = '1.0.0'
private static readonly APPLICATION_ID = 'zeal-js-sdk'
```

### Python SDK
```python
class ClientConfig:
    base_url: str
    auth_token: Optional[str]  # Only auth field needed
    # ... other non-auth config

# Internally hardcoded:
SDK_VERSION = "1.0.0"
APPLICATION_ID = "zeal-python-sdk"
```

### Go SDK
```go
type ClientConfig struct {
    BaseURL   string
    AuthToken string  // Only auth field needed
    // ... other non-auth config
}

// Internally hardcoded:
const (
    SDKVersion    = "1.0.0"
    ApplicationID = "zeal-go-sdk"
)
```

### Rust SDK
```rust
pub struct ClientConfig {
    pub base_url: String,
    pub auth: Option<AuthConfig>,  // Optional auth config
    // ... other non-auth config
}

pub struct AuthConfig {
    pub bearer_token: String,  // Bearer token only (no API key)
}

// Internally hardcoded:
pub const VERSION: &str = "1.0.0";
pub const APPLICATION_ID: &str = "zeal-rust-sdk";
```

### Java SDK (To Be Implemented)
```java
public class ClientConfig {
    private String baseUrl;
    private String authToken;  // Only auth field needed
    // ... other non-auth config
}

// Internally hardcoded:
public static final String SDK_VERSION = "1.0.0";
public static final String APPLICATION_ID = "zeal-java-sdk";
```

## Implementation Pattern

All SDKs should follow this pattern when making requests:

```pseudocode
function makeRequest(url, options, config):
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "<sdk-name>/<version>"
    }
    
    // Add auth token if provided
    if config.authToken:
        headers["Authorization"] = "Bearer " + config.authToken
    
    // Make request with headers
    return http.request(url, {
        ...options,
        headers: headers
    })
```

## Usage Examples

### JavaScript/TypeScript
```typescript
const client = new ZealClient({
  baseUrl: 'http://localhost:3000',
  authToken: 'your-auth-token'  // Simple!
});
```

### Python
```python
client = ZealClient(ClientConfig(
    base_url="http://localhost:3000",
    auth_token="your-auth-token"  # Simple!
))
```

### Go
```go
client, _ := zeal.NewClient(zeal.ClientConfig{
    BaseURL:   "http://localhost:3000",
    AuthToken: "your-auth-token",  // Simple!
})
```

### Rust
```rust
let client = ZealClient::new(ClientConfig {
    base_url: "http://localhost:3000".to_string(),
    auth: Some(AuthConfig::new("your-auth-token")),  // Simple!
    ..Default::default()
})?;
```

### Java (When Implemented)
```java
ClientConfig config = ClientConfig.builder()
    .baseUrl("http://localhost:3000")
    .authToken("your-auth-token")  // Simple!
    .build();
ZealClient client = new ZealClient(config);
```

## Key Points

1. **User Simplicity**: Users only need to provide an auth token
2. **No Metadata Collection**: SDK version and app ID are not collected from users
3. **Consistent Interface**: All SDKs have the same simple auth configuration
4. **Header-Based Auth**: All SDKs send auth via standard Authorization header
5. **Optional Auth**: Auth token is optional - SDKs work without it when auth is disabled

## Server-Side Expectations

The ZIP middleware (`/lib/auth/zip-middleware.ts`) expects:
- Auth token in `Authorization: Bearer <token>` header
- No auth context in request body
- Auth is optional when `AUTH_ENABLED=false`