//! Error types for the Zeal SDK

/// Result type alias for Zeal SDK operations
pub type Result<T> = std::result::Result<T, ZealError>;

/// Main error type for the Zeal SDK  
#[derive(Debug, thiserror::Error)]
pub enum ZealError {
    /// Network-related errors
    #[error("Network error: {source}")]
    NetworkError {
        #[source]
        source: reqwest::Error,
        retryable: bool,
    },

    /// WebSocket-related errors
    #[error("WebSocket error: {message}")]
    WebSocketError { message: String },

    /// JSON parsing errors
    #[error("JSON error: {source}")]
    JsonError {
        #[source]
        source: serde_json::Error,
    },

    /// Invalid configuration
    #[error("Configuration error: {message}")]
    ConfigurationError { message: String },

    /// API errors from the server
    #[error("API error ({status}): {message}")]
    ApiError {
        status: u16,
        message: String,
        error_code: Option<String>,
    },

    /// Resource not found
    #[error("Resource not found: {resource} with ID '{id}'")]
    NotFound { resource: String, id: String },

    /// Validation errors
    #[error("Validation error in field '{field}': {message}")]
    ValidationError { field: String, message: String },

    /// Authentication/authorization errors
    #[error("Authentication error: {message}")]
    AuthenticationError { message: String },

    /// Rate limiting errors
    #[error("Rate limit exceeded: {message}")]
    RateLimitError {
        message: String,
        retry_after: Option<std::time::Duration>,
    },

    /// Timeout errors
    #[error("Operation timed out: {operation}")]
    TimeoutError { operation: String },

    /// Connection errors
    #[error("Connection error: {message}")]
    ConnectionError { message: String },

    /// Serialization errors
    #[error("Serialization error: {source}")]
    SerializationError {
        #[source]
        source: Box<dyn std::error::Error + Send + Sync>,
    },

    /// URL parsing errors
    #[error("Invalid URL: {source}")]
    InvalidUrl {
        #[source]
        source: url::ParseError,
    },

    /// I/O errors
    #[error("I/O error: {source}")]
    IoError {
        #[source]
        source: std::io::Error,
    },

    /// Generic errors
    #[error("Error: {message}")]
    Other { message: String },
}

impl Clone for ZealError {
    fn clone(&self) -> Self {
        match self {
            Self::NetworkError { .. } => Self::Other {
                message: "Network error".to_string(),
            },
            Self::WebSocketError { message } => Self::WebSocketError {
                message: message.clone(),
            },
            Self::JsonError { .. } => Self::Other {
                message: "JSON parsing error".to_string(),
            },
            Self::ConfigurationError { message } => Self::ConfigurationError {
                message: message.clone(),
            },
            Self::ApiError {
                status,
                message,
                error_code,
            } => Self::ApiError {
                status: *status,
                message: message.clone(),
                error_code: error_code.clone(),
            },
            Self::NotFound { resource, id } => Self::NotFound {
                resource: resource.clone(),
                id: id.clone(),
            },
            Self::ValidationError { field, message } => Self::ValidationError {
                field: field.clone(),
                message: message.clone(),
            },
            Self::AuthenticationError { message } => Self::AuthenticationError {
                message: message.clone(),
            },
            Self::RateLimitError {
                message,
                retry_after,
            } => Self::RateLimitError {
                message: message.clone(),
                retry_after: *retry_after,
            },
            Self::TimeoutError { operation } => Self::TimeoutError {
                operation: operation.clone(),
            },
            Self::ConnectionError { message } => Self::ConnectionError {
                message: message.clone(),
            },
            Self::SerializationError { .. } => Self::Other {
                message: "Serialization error".to_string(),
            },
            Self::InvalidUrl { .. } => Self::Other {
                message: "Invalid URL".to_string(),
            },
            Self::IoError { .. } => Self::Other {
                message: "IO error".to_string(),
            },
            Self::Other { message } => Self::Other {
                message: message.clone(),
            },
        }
    }
}

impl ZealError {
    /// Create a network error
    pub fn network_error(source: reqwest::Error) -> Self {
        let retryable = source.is_timeout()
            || source.is_connect()
            || source
                .status()
                .is_some_and(|s| matches!(s.as_u16(), 408 | 429 | 500..=599));

        Self::NetworkError { source, retryable }
    }

    /// Create a WebSocket error
    pub fn websocket_error<S: Into<String>>(message: S) -> Self {
        Self::WebSocketError {
            message: message.into(),
        }
    }

    /// Create a configuration error
    pub fn configuration_error<S: Into<String>>(message: S) -> Self {
        Self::ConfigurationError {
            message: message.into(),
        }
    }

    /// Create an API error
    pub fn api_error(status: u16, message: String, error_code: Option<String>) -> Self {
        Self::ApiError {
            status,
            message,
            error_code,
        }
    }

    /// Create a not found error
    pub fn not_found<S: Into<String>>(resource: S, id: S) -> Self {
        Self::NotFound {
            resource: resource.into(),
            id: id.into(),
        }
    }

    /// Create a validation error
    pub fn validation_error<S: Into<String>>(field: S, message: S) -> Self {
        Self::ValidationError {
            field: field.into(),
            message: message.into(),
        }
    }

    /// Create an authentication error
    pub fn authentication_error<S: Into<String>>(message: S) -> Self {
        Self::AuthenticationError {
            message: message.into(),
        }
    }

    /// Create a rate limit error
    pub fn rate_limit_error<S: Into<String>>(
        message: S,
        retry_after: Option<std::time::Duration>,
    ) -> Self {
        Self::RateLimitError {
            message: message.into(),
            retry_after,
        }
    }

    /// Create a timeout error
    pub fn timeout_error<S: Into<String>>(operation: S) -> Self {
        Self::TimeoutError {
            operation: operation.into(),
        }
    }

    /// Create a connection error
    pub fn connection_error<S: Into<String>>(message: S) -> Self {
        Self::ConnectionError {
            message: message.into(),
        }
    }

    /// Create a generic error
    pub fn other<S: Into<String>>(message: S) -> Self {
        Self::Other {
            message: message.into(),
        }
    }

    /// Check if the error is retryable
    pub fn is_retryable(&self) -> bool {
        match self {
            Self::NetworkError { retryable, .. } => *retryable,
            Self::RateLimitError { .. } => true,
            Self::TimeoutError { .. } => true,
            Self::ConnectionError { .. } => true,
            Self::ApiError { status, .. } => matches!(*status, 408 | 429 | 500..=599),
            _ => false,
        }
    }

    /// Get the retry delay if applicable
    pub fn retry_after(&self) -> Option<std::time::Duration> {
        match self {
            Self::RateLimitError { retry_after, .. } => *retry_after,
            _ => None,
        }
    }

    /// Check if the error is a client error (4xx)
    pub fn is_client_error(&self) -> bool {
        match self {
            Self::ApiError { status, .. } => matches!(*status, 400..=499),
            Self::NotFound { .. } => true,
            Self::ValidationError { .. } => true,
            Self::AuthenticationError { .. } => true,
            _ => false,
        }
    }

    /// Check if the error is a server error (5xx)
    pub fn is_server_error(&self) -> bool {
        match self {
            Self::ApiError { status, .. } => matches!(*status, 500..=599),
            _ => false,
        }
    }
}

impl From<reqwest::Error> for ZealError {
    fn from(err: reqwest::Error) -> Self {
        Self::network_error(err)
    }
}

impl From<serde_json::Error> for ZealError {
    fn from(err: serde_json::Error) -> Self {
        Self::JsonError { source: err }
    }
}

impl From<url::ParseError> for ZealError {
    fn from(err: url::ParseError) -> Self {
        Self::InvalidUrl { source: err }
    }
}

impl From<std::io::Error> for ZealError {
    fn from(err: std::io::Error) -> Self {
        Self::IoError { source: err }
    }
}

impl From<tokio_tungstenite::tungstenite::Error> for ZealError {
    fn from(err: tokio_tungstenite::tungstenite::Error) -> Self {
        Self::websocket_error(err.to_string())
    }
}

/// Error builder for constructing complex errors
#[derive(Debug, Default)]
pub struct ErrorBuilder {
    message: Option<String>,
    source: Option<Box<dyn std::error::Error + Send + Sync>>,
    retryable: bool,
    status: Option<u16>,
    error_code: Option<String>,
}

impl ErrorBuilder {
    /// Create a new error builder
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the error message
    pub fn message<S: Into<String>>(mut self, message: S) -> Self {
        self.message = Some(message.into());
        self
    }

    /// Set the source error
    pub fn source<E: std::error::Error + Send + Sync + 'static>(mut self, source: E) -> Self {
        self.source = Some(Box::new(source));
        self
    }

    /// Mark the error as retryable
    pub fn retryable(mut self, retryable: bool) -> Self {
        self.retryable = retryable;
        self
    }

    /// Set the HTTP status code
    pub fn status(mut self, status: u16) -> Self {
        self.status = Some(status);
        self
    }

    /// Set the error code
    pub fn error_code<S: Into<String>>(mut self, code: S) -> Self {
        self.error_code = Some(code.into());
        self
    }

    /// Build the error
    pub fn build(self) -> ZealError {
        let message = self.message.unwrap_or_else(|| "Unknown error".to_string());

        if let Some(status) = self.status {
            ZealError::ApiError {
                status,
                message,
                error_code: self.error_code,
            }
        } else if let Some(source) = self.source {
            ZealError::SerializationError { source }
        } else {
            ZealError::Other { message }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_creation() {
        let err = ZealError::not_found("template", "test-id");
        assert!(matches!(err, ZealError::NotFound { .. }));
    }

    #[test]
    fn test_retryable_errors() {
        let err = ZealError::api_error(500, "Server error".to_string(), None);
        assert!(err.is_retryable());

        let err = ZealError::api_error(400, "Bad request".to_string(), None);
        assert!(!err.is_retryable());
    }

    #[test]
    fn test_error_builder() {
        let err = ErrorBuilder::new()
            .message("Test error")
            .status(404)
            .build();

        assert!(matches!(err, ZealError::ApiError { status: 404, .. }));
    }

    #[test]
    fn test_client_server_error_classification() {
        let client_err = ZealError::api_error(400, "Bad request".to_string(), None);
        assert!(client_err.is_client_error());
        assert!(!client_err.is_server_error());

        let server_err = ZealError::api_error(500, "Server error".to_string(), None);
        assert!(!server_err.is_client_error());
        assert!(server_err.is_server_error());
    }
}
