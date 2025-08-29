/**
 * WebSocket authorization for Zeal
 */

import { ZealAuth } from '../index';
import { Subject, Resource, AuthorizationResult } from '../types';

/**
 * WebSocket authorization configuration
 */
export interface WebSocketAuthConfig {
  auth: ZealAuth;
  extractToken?: (socket: any) => string | null;
  onUnauthorized?: (socket: any, reason: string) => void;
  enableChannelAuth?: boolean;
  enableMessageAuth?: boolean;
  rateLimiting?: {
    enabled: boolean;
    messagesPerMinute?: number;
    connectionsPerIP?: number;
  };
}

/**
 * Socket.io authorization middleware
 */
export function createSocketIOAuth(config: WebSocketAuthConfig) {
  return async (socket: any, next: any) => {
    try {
      // Extract token
      const extractToken = config.extractToken || defaultExtractToken;
      const token = extractToken(socket);
      
      if (!token) {
        const error = new Error('Authentication required');
        (error as any).data = { code: 401, message: 'No token provided' };
        return next(error);
      }
      
      // Validate token and get subject
      const subject = await config.auth.contextBuilder.extractSubject(token);
      
      // Authorize WebSocket connection
      const result = await config.auth.authorize(
        subject,
        { type: 'websocket' as any },
        'connect'
      );
      
      if (!result.allowed) {
        const error = new Error(result.reason || 'Access denied');
        (error as any).data = { code: 403, message: result.reason };
        return next(error);
      }
      
      // Attach auth context to socket
      socket.auth = {
        subject,
        token,
        result,
        permissions: await config.auth.getEffectivePermissions(subject)
      };
      
      // Set up channel authorization if enabled
      if (config.enableChannelAuth) {
        setupChannelAuth(socket, config.auth);
      }
      
      // Set up message authorization if enabled
      if (config.enableMessageAuth) {
        setupMessageAuth(socket, config.auth);
      }
      
      // Set up rate limiting if enabled
      if (config.rateLimiting?.enabled) {
        setupRateLimiting(socket, config.rateLimiting);
      }
      
      next();
    } catch (error: any) {
      const authError = new Error('Authorization failed');
      (authError as any).data = { 
        code: 500, 
        message: error.message || 'Internal error' 
      };
      next(authError);
    }
  };
}

/**
 * WS (ws library) authorization
 */
export function createWSAuth(config: WebSocketAuthConfig) {
  return async (ws: any, req: any) => {
    try {
      // Extract token from request
      const token = extractTokenFromRequest(req);
      
      if (!token) {
        ws.close(1008, 'Authentication required');
        return false;
      }
      
      // Validate token and get subject
      const subject = await config.auth.contextBuilder.extractSubject(token);
      
      // Authorize WebSocket connection
      const result = await config.auth.authorize(
        subject,
        { type: 'websocket' as any },
        'connect'
      );
      
      if (!result.allowed) {
        ws.close(1008, result.reason || 'Access denied');
        return false;
      }
      
      // Attach auth context
      ws.auth = {
        subject,
        token,
        result,
        permissions: await config.auth.getEffectivePermissions(subject)
      };
      
      // Set up message handler with authorization
      const originalOn = ws.on.bind(ws);
      ws.on = function(event: string, handler: Function) {
        if (event === 'message') {
          const wrappedHandler = createAuthorizedMessageHandler(
            handler,
            ws.auth,
            config.auth
          );
          return originalOn(event, wrappedHandler);
        }
        return originalOn(event, handler);
      };
      
      return true;
    } catch (error) {
      ws.close(1008, 'Authorization failed');
      return false;
    }
  };
}

/**
 * Channel-based authorization for Socket.io
 */
function setupChannelAuth(socket: any, auth: ZealAuth) {
  // Override join method
  const originalJoin = socket.join.bind(socket);
  
  socket.join = async function(channel: string) {
    // Check authorization for channel
    const result = await auth.authorize(
      socket.auth.subject,
      { 
        type: 'channel' as any,
        id: channel,
        attributes: { socketId: socket.id }
      },
      'join'
    );
    
    if (!result.allowed) {
      socket.emit('channel_error', {
        channel,
        error: 'Not authorized to join channel',
        reason: result.reason
      });
      return;
    }
    
    // Store channel authorization
    if (!socket.auth.channels) {
      socket.auth.channels = {};
    }
    socket.auth.channels[channel] = result;
    
    // Join the channel
    return originalJoin(channel);
  };
  
  // Override leave method to clean up
  const originalLeave = socket.leave.bind(socket);
  
  socket.leave = function(channel: string) {
    if (socket.auth.channels) {
      delete socket.auth.channels[channel];
    }
    return originalLeave(channel);
  };
}

/**
 * Message-level authorization
 */
function setupMessageAuth(socket: any, auth: ZealAuth) {
  // Store original emit
  const originalEmit = socket.emit.bind(socket);
  
  // Override emit to check authorization
  socket.emit = async function(event: string, ...args: any[]) {
    // Skip authorization for system events
    if (event.startsWith('$') || event === 'error' || event === 'disconnect') {
      return originalEmit(event, ...args);
    }
    
    // Check message authorization
    const result = await auth.authorize(
      socket.auth.subject,
      {
        type: 'message' as any,
        attributes: {
          event,
          socketId: socket.id
        }
      },
      'send'
    );
    
    if (!result.allowed) {
      socket.emit('message_error', {
        event,
        error: 'Not authorized to send message',
        reason: result.reason
      });
      return;
    }
    
    // Apply constraints if any
    if (result.constraints) {
      args = applyMessageConstraints(args, result.constraints);
    }
    
    return originalEmit(event, ...args);
  };
  
  // Intercept incoming messages
  socket.use(async (packet: any[], next: any) => {
    const [event, data] = packet;
    
    // Check receive authorization
    const result = await auth.authorize(
      socket.auth.subject,
      {
        type: 'message' as any,
        attributes: {
          event,
          socketId: socket.id
        }
      },
      'receive'
    );
    
    if (!result.allowed) {
      return next(new Error(`Not authorized to receive ${event}`));
    }
    
    // Apply data filtering if constraints exist
    if (result.constraints) {
      packet[1] = applyMessageConstraints([data], result.constraints)[0];
    }
    
    next();
  });
}

/**
 * Rate limiting for WebSocket connections
 */
function setupRateLimiting(socket: any, config: any) {
  const messageCount = new Map<string, number>();
  const resetInterval = 60000; // 1 minute
  
  // Reset counts periodically
  setInterval(() => {
    messageCount.clear();
  }, resetInterval);
  
  // Track message rate
  socket.use((packet: any[], next: any) => {
    const key = socket.auth.subject.id;
    const current = messageCount.get(key) || 0;
    const limit = config.messagesPerMinute || 60;
    
    if (current >= limit) {
      return next(new Error('Rate limit exceeded'));
    }
    
    messageCount.set(key, current + 1);
    next();
  });
}

/**
 * Create authorized message handler for ws
 */
function createAuthorizedMessageHandler(
  originalHandler: Function,
  authContext: any,
  auth: ZealAuth
) {
  return async function(data: any) {
    try {
      // Parse message if it's a string
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Check message authorization
      const result = await auth.authorize(
        authContext.subject,
        {
          type: 'message' as any,
          attributes: {
            type: message.type,
            action: message.action
          }
        },
        'process'
      );
      
      if (!result.allowed) {
        this.send(JSON.stringify({
          error: 'Not authorized',
          reason: result.reason
        }));
        return;
      }
      
      // Call original handler
      originalHandler.call(this, data);
    } catch (error: any) {
      this.send(JSON.stringify({
        error: 'Authorization error',
        message: error.message
      }));
    }
  };
}

/**
 * Apply constraints to message data
 */
function applyMessageConstraints(data: any[], constraints: any): any[] {
  if (!constraints) return data;
  
  return data.map(item => {
    if (typeof item !== 'object') return item;
    
    // Apply field restrictions
    if (constraints.fields) {
      const filtered: any = {};
      for (const field of constraints.fields) {
        if (field in item) {
          filtered[field] = item[field];
        }
      }
      return filtered;
    }
    
    return item;
  });
}

/**
 * Default token extraction for Socket.io
 */
function defaultExtractToken(socket: any): string | null {
  // Check handshake auth
  if (socket.handshake?.auth?.token) {
    return socket.handshake.auth.token;
  }
  
  // Check handshake query
  if (socket.handshake?.query?.token) {
    return socket.handshake.query.token;
  }
  
  // Check handshake headers
  const authHeader = socket.handshake?.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

/**
 * Extract token from HTTP request (for ws)
 */
function extractTokenFromRequest(req: any): string | null {
  // Check Authorization header
  const authHeader = req.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check query parameters
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  if (token) {
    return token;
  }
  
  // Check cookies
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.token) {
    return cookies.token;
  }
  
  return null;
}

/**
 * Parse cookies from header
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  
  return cookies;
}

/**
 * WebSocket authorization helper for channel-based messaging
 */
export class WebSocketAuthHelper {
  constructor(private auth: ZealAuth) {}
  
  /**
   * Get authorized channels for a subject
   */
  async getAuthorizedChannels(subject: Subject): Promise<string[]> {
    const channels: string[] = [];
    
    // Add user's private channel
    channels.push(`user:${subject.id}`);
    
    // Add tenant channel if applicable
    if (subject.tenantId) {
      channels.push(`tenant:${subject.tenantId}`);
    }
    
    // Add organization channels
    if (subject.organizationId) {
      channels.push(`org:${subject.organizationId}`);
    }
    
    // Add team channels
    if (subject.teams) {
      subject.teams.forEach(teamId => {
        channels.push(`team:${teamId}`);
      });
    }
    
    // Add role-based channels
    if (subject.roles) {
      subject.roles.forEach(role => {
        channels.push(`role:${role}`);
      });
    }
    
    // Add public channel if user has permission
    const permissions = await this.auth.getEffectivePermissions(subject);
    if (permissions.includes('channels.public.join')) {
      channels.push('public');
    }
    
    return channels;
  }
  
  /**
   * Check if subject can send to channel
   */
  async canSendToChannel(
    subject: Subject,
    channel: string
  ): Promise<boolean> {
    const result = await this.auth.authorize(
      subject,
      { 
        type: 'channel' as any,
        id: channel
      },
      'send'
    );
    
    return result.allowed;
  }
  
  /**
   * Check if subject can receive from channel
   */
  async canReceiveFromChannel(
    subject: Subject,
    channel: string
  ): Promise<boolean> {
    const result = await this.auth.authorize(
      subject,
      { 
        type: 'channel' as any,
        id: channel
      },
      'receive'
    );
    
    return result.allowed;
  }
  
  /**
   * Filter message based on subject's permissions
   */
  async filterMessage(
    subject: Subject,
    message: any
  ): Promise<any> {
    // Get subject's constraints
    const result = await this.auth.authorize(
      subject,
      { type: 'message' as any },
      'read'
    );
    
    if (!result.allowed) {
      return null;
    }
    
    if (result.constraints?.fields) {
      const filtered: any = {};
      for (const field of result.constraints.fields) {
        if (field in message) {
          filtered[field] = message[field];
        }
      }
      return filtered;
    }
    
    return message;
  }
}