package com.offbit.zeal.exceptions;

/**
 * Base exception for all Zeal SDK errors.
 */
public class ZealException extends Exception {
    private final int statusCode;
    private final String errorCode;

    public ZealException(String message) {
        super(message);
        this.statusCode = 0;
        this.errorCode = null;
    }

    public ZealException(String message, Throwable cause) {
        super(message, cause);
        this.statusCode = 0;
        this.errorCode = null;
    }

    public ZealException(String message, int statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = null;
    }

    public ZealException(String message, int statusCode, String errorCode) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
    }

    public ZealException(String message, int statusCode, String errorCode, Throwable cause) {
        super(message, cause);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getErrorCode() {
        return errorCode;
    }

    /**
     * Check if this is a network-related error.
     */
    public boolean isNetworkError() {
        return statusCode == 0 && getCause() instanceof java.io.IOException;
    }

    /**
     * Check if this is a timeout error.
     */
    public boolean isTimeout() {
        return getCause() instanceof java.net.SocketTimeoutException ||
               getCause() instanceof java.util.concurrent.TimeoutException;
    }

    /**
     * Check if this is a client error (4xx).
     */
    public boolean isClientError() {
        return statusCode >= 400 && statusCode < 500;
    }

    /**
     * Check if this is a server error (5xx).
     */
    public boolean isServerError() {
        return statusCode >= 500 && statusCode < 600;
    }
}