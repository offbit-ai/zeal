# SDK Token Generation Guide

This guide explains how to generate authentication tokens for Zeal SDKs in self-hosted deployments.

## Overview

All Zeal SDKs now include token generation utilities that create HMAC-signed tokens for secure authentication. These tokens contain subject information required by the zeal-auth framework and are verified by the ZIP middleware.

## Environment Setup

Set the `ZEAL_SECRET_KEY` environment variable on both client and server:

```bash
# Server-side (where Zeal is running)
export ZEAL_SECRET_KEY="your-secret-key-here"

# Client-side (where SDK is used)
export ZEAL_SECRET_KEY="your-secret-key-here"
```

⚠️ **Important**: The same secret key must be used on both client and server for token verification to work.

## Token Generation by SDK

### TypeScript/JavaScript SDK

```typescript
import { generateAuthToken, createUserToken, createServiceToken, createApiKeyToken } from '@offbit-ai/zeal-sdk';

// Generic token generation
const token = generateAuthToken({
  id: 'user-123',
  type: 'user',
  tenantId: 'tenant-456',
  roles: ['admin', 'developer'],
  permissions: ['workflow:create', 'workflow:execute']
}, {
  expiresIn: 3600, // 1 hour
  secretKey: 'your-secret-key' // or use ZEAL_SECRET_KEY env var
});

// Convenience methods
const userToken = createUserToken('user-123', 'tenant-456', ['admin']);
const serviceToken = createServiceToken('service-abc', 'tenant-456', ['api:read']);
const apiKeyToken = createApiKeyToken('key-xyz', 'tenant-456', ['workflow:execute']);

// Use the token with the client
const client = new ZealClient({
  baseUrl: 'http://localhost:3000',
  authToken: token
});
```

### Python SDK

```python
from zeal import generate_auth_token, create_user_token, TokenSubject, TokenOptions

# Generic token generation
token = generate_auth_token(
    TokenSubject(
        id="user-123",
        type="user",
        tenant_id="tenant-456",
        roles=["admin", "developer"],
        permissions=["workflow:create", "workflow:execute"]
    ),
    TokenOptions(
        expires_in=3600,  # 1 hour
        secret_key="your-secret-key"  # or use ZEAL_SECRET_KEY env var
    )
)

# Convenience methods
user_token = create_user_token("user-123", "tenant-456", ["admin"])
service_token = create_service_token("service-abc", "tenant-456", ["api:read"])
api_key_token = create_api_key_token("key-xyz", "tenant-456", ["workflow:execute"])

# Use the token
from zeal import ZealClient, ClientConfig

client = ZealClient(ClientConfig(
    base_url="http://localhost:3000",
    auth_token=token
))
```

### Go SDK

```go
import (
    "github.com/offbit-ai/zeal-go-sdk"
)

// Generic token generation
token, err := zeal.GenerateAuthToken(&zeal.TokenSubject{
    ID:          "user-123",
    Type:        "user",
    TenantID:    "tenant-456",
    Roles:       []string{"admin", "developer"},
    Permissions: []string{"workflow:create", "workflow:execute"},
}, &zeal.TokenOptions{
    ExpiresIn: 3600, // 1 hour
    SecretKey: "your-secret-key", // or use ZEAL_SECRET_KEY env var
})

// Convenience methods
userToken, _ := zeal.CreateUserToken("user-123", "tenant-456", []string{"admin"}, nil)
serviceToken, _ := zeal.CreateServiceToken("service-abc", "tenant-456", []string{"api:read"}, nil)
apiKeyToken, _ := zeal.CreateAPIKeyToken("key-xyz", "tenant-456", []string{"workflow:execute"}, nil)

// Use the token
client, _ := zeal.NewClient(zeal.ClientConfig{
    BaseURL:   "http://localhost:3000",
    AuthToken: token,
})
```

### Rust SDK

```rust
use zeal_sdk::auth::{generate_auth_token, TokenSubject, TokenOptions};

// Generic token generation
let token = generate_auth_token(
    &TokenSubject {
        id: "user-123".to_string(),
        subject_type: Some("user".to_string()),
        tenant_id: Some("tenant-456".to_string()),
        roles: Some(vec!["admin".to_string(), "developer".to_string()]),
        permissions: Some(vec!["workflow:create".to_string()]),
        ..Default::default()
    },
    Some(TokenOptions {
        expires_in: Some(3600), // 1 hour
        secret_key: Some("your-secret-key".to_string()), // or use ZEAL_SECRET_KEY env var
        ..Default::default()
    }),
)?;

// Convenience methods
let user_token = create_user_token("user-123", "tenant-456", vec!["admin".to_string()], None)?;
let service_token = create_service_token("service-abc", "tenant-456", vec!["api:read".to_string()], None)?;
let api_key_token = create_api_key_token("key-xyz", "tenant-456", vec!["workflow:execute".to_string()], None)?;

// Use the token
let client = ZealClient::new(ClientConfig {
    base_url: "http://localhost:3000".to_string(),
    auth_config: Some(AuthConfig {
        bearer_token: token,
    }),
    ..Default::default()
})?;
```

### Java SDK

```java
import com.zeal.sdk.auth.TokenAuth;
import com.zeal.sdk.auth.TokenAuth.TokenSubject;
import com.zeal.sdk.auth.TokenAuth.TokenOptions;

// Generic token generation
TokenSubject subject = new TokenSubject("user-123");
subject.subjectType = "user";
subject.tenantId = "tenant-456";
subject.roles = Arrays.asList("admin", "developer");
subject.permissions = Arrays.asList("workflow:create", "workflow:execute");

TokenOptions options = new TokenOptions();
options.expiresIn = 3600; // 1 hour
options.secretKey = "your-secret-key"; // or use ZEAL_SECRET_KEY env var

String token = TokenAuth.generateAuthToken(subject, options);

// Convenience methods
String userToken = TokenAuth.createUserToken("user-123", "tenant-456", 
    Arrays.asList("admin"), null);
String serviceToken = TokenAuth.createServiceToken("service-abc", "tenant-456",
    Arrays.asList("api:read"), null);
String apiKeyToken = TokenAuth.createApiKeyToken("key-xyz", "tenant-456",
    Arrays.asList("workflow:execute"), null);

// Use the token
ZealClient client = new ZealClient.Builder()
    .baseUrl("http://localhost:3000")
    .authToken(token)
    .build();
```

## Token Structure

Tokens are composed of two parts separated by a dot (`.`):
1. **Payload**: Base64URL-encoded JSON containing subject information
2. **Signature**: HMAC-SHA256 signature of the payload

Example token structure:
```
eyJzdWIiOiJ1c2VyLTEyMyIsImlhdCI6MTcwNDM4MDQwMCwi...}.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

## Token Payload Fields

| Field | Description | Required |
|-------|-------------|----------|
| `sub` | Subject ID (user, service, or API key ID) | Yes |
| `type` | Subject type: `user`, `service`, or `api_key` | No |
| `tenant_id` | Tenant identifier for multi-tenancy | Recommended |
| `organization_id` | Organization identifier | No |
| `teams` | Array of team IDs | No |
| `groups` | Array of group IDs | No |
| `roles` | Array of role names | No |
| `permissions` | Array of permission strings | No |
| `exp` | Expiration timestamp (Unix epoch) | No |
| `iat` | Issued at timestamp (Unix epoch) | Auto-generated |
| `nbf` | Not before timestamp (Unix epoch) | No |
| `session_id` | Unique session identifier | Auto-generated |
| `sdk_version` | SDK version | Auto-generated |
| `application_id` | SDK identifier | Auto-generated |

## Token Verification

Tokens are automatically verified by the ZIP middleware when `ZEAL_SECRET_KEY` is set:

1. **Signature Verification**: HMAC-SHA256 signature is validated
2. **Expiration Check**: Token expiration time is checked if set
3. **Not Before Check**: Token activation time is checked if set

### Manual Verification

All SDKs provide verification functions:

```typescript
// TypeScript
import { verifyAndParseToken, isTokenValid } from '@offbit-ai/zeal-sdk';

const payload = verifyAndParseToken(token, secretKey);
const isValid = isTokenValid(token, secretKey);
```

```python
# Python
from zeal import verify_and_parse_token, is_token_valid

payload = verify_and_parse_token(token, secret_key)
is_valid = is_token_valid(token, secret_key)
```

## Security Best Practices

1. **Secret Key Management**:
   - Use a strong, randomly generated secret key (at least 32 characters)
   - Store the secret key securely (e.g., environment variables, secrets manager)
   - Rotate secret keys periodically
   - Never commit secret keys to version control

2. **Token Expiration**:
   - Always set token expiration for production use
   - Use short-lived tokens (1-24 hours) for users
   - Use longer-lived tokens for service accounts if needed
   - Implement token refresh mechanisms for long-running operations

3. **Permissions and Roles**:
   - Follow the principle of least privilege
   - Grant only necessary permissions
   - Use roles to group related permissions
   - Regularly audit and review permissions

4. **Network Security**:
   - Always use HTTPS in production
   - Implement rate limiting
   - Monitor for suspicious authentication patterns

## Deployment Configuration

Add `ZEAL_SECRET_KEY` to your deployment configuration:

### Docker Compose
```yaml
services:
  zeal:
    environment:
      - ZEAL_SECRET_KEY=${ZEAL_SECRET_KEY}
```

### Kubernetes
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: zeal-auth-secret
data:
  ZEAL_SECRET_KEY: <base64-encoded-secret>
```

### Environment File (.env)
```bash
ZEAL_SECRET_KEY=your-secret-key-here
AUTH_ENABLED=true
```

## Troubleshooting

### Invalid Token Signature
- Ensure the same `ZEAL_SECRET_KEY` is used on client and server
- Check that the token hasn't been modified in transit
- Verify the secret key doesn't contain special characters that need escaping

### Token Expired
- Check system clocks are synchronized
- Increase token expiration time if needed
- Implement token refresh before expiration

### Missing Authentication
- Ensure `AUTH_ENABLED=true` is set on the server
- Verify the token is included in the Authorization header: `Bearer <token>`
- Check that the SDK is configured with the token

## Migration from Existing Auth

If migrating from existing authentication:

1. Generate tokens using the SDK functions
2. Replace existing auth tokens with generated tokens
3. Update client initialization to use new tokens
4. Test thoroughly in a staging environment
5. Deploy with `AUTH_ENABLED=true` and `ZEAL_SECRET_KEY` set

## Support

For issues or questions about token generation:
- Check the SDK-specific documentation
- Review the zeal-auth framework documentation
- Open an issue on the Zeal GitHub repository