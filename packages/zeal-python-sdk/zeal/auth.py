"""
Authentication utilities for ZIP SDK
Generates auth tokens with the required information for zeal-auth
"""

import base64
import hashlib
import hmac
import json
import os
import time
import uuid
from typing import Dict, Any, Optional, List, Union
from dataclasses import dataclass, asdict


@dataclass
class TokenSubject:
    """Subject information required by zeal-auth"""
    id: str
    type: Optional[str] = None  # 'user' | 'service' | 'api_key'
    tenant_id: Optional[str] = None
    organization_id: Optional[str] = None
    teams: Optional[List[str]] = None
    groups: Optional[List[str]] = None
    roles: Optional[List[str]] = None
    permissions: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class TokenOptions:
    """Token generation options"""
    expires_in: Optional[int] = None  # seconds
    issuer: Optional[str] = None
    audience: Optional[Union[str, List[str]]] = None
    not_before: Optional[int] = None  # timestamp
    secret_key: Optional[str] = None  # ZEAL_SECRET_KEY for signing


def generate_auth_token(
    subject: Union[TokenSubject, Dict[str, Any]],
    options: Optional[Union[TokenOptions, Dict[str, Any]]] = None
) -> str:
    """
    Generate a signed token for self-hosted Zeal integrators
    Uses HMAC-SHA256 for signing with the provided secret key
    
    Args:
        subject: Subject information to include in the token
        options: Token generation options (including secretKey)
        
    Returns:
        Signed token string in format: base64(payload).signature
        
    Raises:
        ValueError: If ZEAL_SECRET_KEY is not provided
    """
    if isinstance(subject, dict):
        subject = TokenSubject(**subject)
    
    if options is None:
        options = TokenOptions()
    elif isinstance(options, dict):
        options = TokenOptions(**options)
    
    # Get secret key from options or environment
    secret_key = options.secret_key or os.environ.get('ZEAL_SECRET_KEY')
    if not secret_key:
        raise ValueError(
            'ZEAL_SECRET_KEY is required for token generation. '
            'Set it as an environment variable or pass it in options.'
        )
    
    now = int(time.time())
    
    payload = {
        "sub": subject.id,
        "iat": now,
        "sdk_version": "1.0.0",
        "application_id": "zeal-python-sdk",
        "session_id": uuid.uuid4().hex[:16]
    }
    
    # Add subject fields
    if subject.type:
        payload["type"] = subject.type
    if subject.tenant_id:
        payload["tenant_id"] = subject.tenant_id
    if subject.organization_id:
        payload["organization_id"] = subject.organization_id
    if subject.teams:
        payload["teams"] = subject.teams
    if subject.groups:
        payload["groups"] = subject.groups
    if subject.roles:
        payload["roles"] = subject.roles
    if subject.permissions:
        payload["permissions"] = subject.permissions
    if subject.metadata:
        payload["metadata"] = subject.metadata
    
    # Add optional claims
    if options.expires_in:
        payload["exp"] = now + options.expires_in
    if options.issuer:
        payload["iss"] = options.issuer
    if options.audience:
        payload["aud"] = options.audience
    if options.not_before:
        payload["nbf"] = options.not_before
    
    # Encode payload as base64url
    payload_string = json.dumps(payload, separators=(',', ':'))
    encoded_payload = base64.urlsafe_b64encode(
        payload_string.encode()
    ).decode().rstrip('=')
    
    # Create HMAC signature
    signature_bytes = hmac.new(
        secret_key.encode(),
        encoded_payload.encode(),
        hashlib.sha256
    ).digest()
    signature = base64.urlsafe_b64encode(signature_bytes).decode().rstrip('=')
    
    # Return token in format: payload.signature
    return f"{encoded_payload}.{signature}"


def verify_and_parse_token(token: str, secret_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Verify and parse a signed token
    
    Args:
        token: Signed token string (payload.signature)
        secret_key: Secret key for verification (optional, uses env var if not provided)
        
    Returns:
        Parsed token payload
        
    Raises:
        ValueError: If token is invalid or signature doesn't match
    """
    key = secret_key or os.environ.get('ZEAL_SECRET_KEY')
    if not key:
        raise ValueError('ZEAL_SECRET_KEY is required for token verification')
    
    parts = token.split('.')
    if len(parts) != 2:
        raise ValueError('Invalid token format')
    
    encoded_payload, signature = parts
    
    # Verify signature
    expected_signature_bytes = hmac.new(
        key.encode(),
        encoded_payload.encode(),
        hashlib.sha256
    ).digest()
    expected_signature = base64.urlsafe_b64encode(
        expected_signature_bytes
    ).decode().rstrip('=')
    
    if signature != expected_signature:
        raise ValueError('Invalid token signature')
    
    # Decode and parse payload
    try:
        # Add padding if needed for base64 decoding
        padding = 4 - (len(encoded_payload) % 4)
        if padding != 4:
            encoded_payload += '=' * padding
        
        decoded = base64.urlsafe_b64decode(encoded_payload).decode()
        return json.loads(decoded)
    except Exception as e:
        raise ValueError(f'Invalid token payload: {e}')


def parse_token_unsafe(token: str) -> Dict[str, Any]:
    """
    Parse a token without verification (USE WITH CAUTION)
    Only use this for debugging or when you don't have the secret key
    
    Args:
        token: Signed token string
        
    Returns:
        Parsed token payload
        
    Raises:
        ValueError: If token format is invalid
    """
    parts = token.split('.')
    if len(parts) != 2:
        raise ValueError('Invalid token format')
    
    encoded_payload = parts[0]
    
    try:
        # Add padding if needed for base64 decoding
        padding = 4 - (len(encoded_payload) % 4)
        if padding != 4:
            encoded_payload += '=' * padding
        
        decoded = base64.urlsafe_b64decode(encoded_payload).decode()
        return json.loads(decoded)
    except Exception as e:
        raise ValueError(f'Invalid token payload: {e}')


def create_service_token(
    service_id: str,
    tenant_id: str,
    permissions: Optional[List[str]] = None,
    options: Optional[Union[TokenOptions, Dict[str, Any]]] = None
) -> str:
    """
    Create a service account token
    Convenience function for creating tokens for service-to-service auth
    
    Args:
        service_id: Service identifier
        tenant_id: Tenant ID the service belongs to
        permissions: Service permissions
        options: Token options
        
    Returns:
        Signed token string
    """
    return generate_auth_token(
        TokenSubject(
            id=service_id,
            type="service",
            tenant_id=tenant_id,
            permissions=permissions or [],
            metadata={
                "service": True,
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
        ),
        options
    )


def create_user_token(
    user_id: str,
    tenant_id: str,
    roles: Optional[List[str]] = None,
    options: Optional[Union[TokenOptions, Dict[str, Any]]] = None
) -> str:
    """
    Create a user token
    Convenience function for creating user authentication tokens
    
    Args:
        user_id: User identifier
        tenant_id: Tenant ID the user belongs to
        roles: User roles
        options: Token options
        
    Returns:
        Signed token string
    """
    return generate_auth_token(
        TokenSubject(
            id=user_id,
            type="user",
            tenant_id=tenant_id,
            roles=roles or [],
            metadata={
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
        ),
        options
    )


def create_api_key_token(
    api_key_id: str,
    tenant_id: str,
    permissions: Optional[List[str]] = None,
    options: Optional[Union[TokenOptions, Dict[str, Any]]] = None
) -> str:
    """
    Create an API key token
    Convenience function for creating API key authentication tokens
    
    Args:
        api_key_id: API key identifier
        tenant_id: Tenant ID the API key belongs to
        permissions: API key permissions
        options: Token options
        
    Returns:
        Signed token string
    """
    return generate_auth_token(
        TokenSubject(
            id=api_key_id,
            type="api_key",
            tenant_id=tenant_id,
            permissions=permissions or [],
            metadata={
                "api_key": True,
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
        ),
        options
    )


def is_token_valid(token: str, secret_key: Optional[str] = None) -> bool:
    """
    Validate token expiration and signature
    
    Args:
        token: Token to validate
        secret_key: Secret key for verification (optional, uses env var if not provided)
        
    Returns:
        True if token is valid and not expired, False otherwise
    """
    try:
        payload = verify_and_parse_token(token, secret_key)
        now = int(time.time())
        
        # Check expiration
        if "exp" in payload and payload["exp"] < now:
            return False
        
        # Check not before
        if "nbf" in payload and payload["nbf"] > now:
            return False
        
        return True
    except:
        return False