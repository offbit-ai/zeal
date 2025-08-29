/**
 * Authentication middleware for OpenAI Functions server
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    apiKey: string;
  };
}

/**
 * Verify API key authentication
 */
export function verifyApiKey(req: AuthRequest, res: Response, next: NextFunction): any {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    logger.warn('Missing API key in request');
    return res.status(401).json({ error: 'API key required' });
  }

  // In production, verify against database or external service
  const expectedKey = process.env.OPENAI_API_KEY || process.env.ZEAL_API_KEY;
  
  if (expectedKey && apiKey !== expectedKey) {
    logger.warn('Invalid API key attempted');
    return res.status(403).json({ error: 'Invalid API key' });
  }

  // Attach user info to request
  req.user = {
    id: 'openai-user',
    apiKey: apiKey as string
  };

  next();
}

/**
 * Optional authentication - doesn't fail if no key provided
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (apiKey) {
    const expectedKey = process.env.OPENAI_API_KEY || process.env.ZEAL_API_KEY;
    
    if (!expectedKey || apiKey === expectedKey) {
      req.user = {
        id: 'openai-user',
        apiKey: apiKey as string
      };
    }
  }

  next();
}