/**
 * OpenAI Functions Server for Zeal
 * Provides OpenAI-compatible function definitions and execution
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { FunctionRegistry } from './functions/registry';
import { FunctionHandler } from './handlers/function-handler';
import { AuthMiddleware } from './middleware/auth';
import { logger } from './utils/logger';
import { ZIPBridge } from '../../shared/zip-bridge';

config();

const app = express();
const PORT = process.env.PORT || 3456;

// Initialize ZIP Bridge
const zipBridge = new ZIPBridge({
  baseUrl: process.env.ZEAL_API_URL || 'http://localhost:3000',
  apiKey: process.env.ZEAL_API_KEY,
  namespace: 'openai-functions'
});

// Initialize function registry and handler
const functionRegistry = new FunctionRegistry(zipBridge);
const functionHandler = new FunctionHandler(functionRegistry, zipBridge);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/functions', limiter);

// Authentication
const auth = new AuthMiddleware({
  jwtSecret: process.env.JWT_SECRET,
  apiKeyHeader: process.env.API_KEY_HEADER || 'X-API-Key'
});

// ============= Routes =============

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * Get all available function definitions
 * This endpoint returns OpenAI-compatible function schemas
 */
app.get('/functions', (req, res) => {
  const functions = functionRegistry.getAllFunctions();
  res.json({
    functions,
    count: functions.length,
    version: '1.0.0',
    compatible_with: 'openai-v2'
  });
});

/**
 * Get function definitions for specific capabilities
 * Useful for loading only relevant functions
 */
app.get('/functions/:category', (req, res) => {
  const { category } = req.params;
  const functions = functionRegistry.getFunctionsByCategory(category);
  res.json({
    category,
    functions,
    count: functions.length
  });
});

/**
 * Extract tools for API usage
 * Returns in format compatible with OpenAI API
 */
app.get('/tools', (req, res) => {
  const functions = functionRegistry.getAllFunctions();
  const tools = functions.map(func => ({
    type: 'function',
    function: func
  }));
  
  res.json(tools);
});

/**
 * Execute a function call
 * Compatible with OpenAI function calling format
 */
app.post('/functions/execute', auth.authenticate, async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        error: 'Function name is required' 
      });
    }

    logger.info(`Executing function: ${name}`, { 
      user: req.user?.id,
      function: name 
    });

    const result = await functionHandler.execute(name, args);
    
    res.json({
      name,
      result,
      executed_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Function execution error:', error);
    
    if (error.message === 'Function not found') {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message.includes('validation')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Function execution failed',
      details: error.message 
    });
  }
});

/**
 * Batch execute multiple function calls
 * Useful for complex workflows
 */
app.post('/functions/batch', auth.authenticate, async (req, res) => {
  try {
    const { calls } = req.body;
    
    if (!Array.isArray(calls)) {
      return res.status(400).json({ 
        error: 'Calls must be an array' 
      });
    }

    const results = await Promise.allSettled(
      calls.map(call => functionHandler.execute(call.name, call.arguments))
    );

    const response = results.map((result, index) => ({
      name: calls[index].name,
      status: result.status,
      result: result.status === 'fulfilled' ? result.value : undefined,
      error: result.status === 'rejected' ? result.reason.message : undefined
    }));

    res.json({
      results: response,
      executed_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Batch execution error:', error);
    res.status(500).json({ 
      error: 'Batch execution failed',
      details: error.message 
    });
  }
});

/**
 * Stream execution events (Server-Sent Events)
 * For real-time updates during workflow execution
 */
app.get('/functions/stream/:executionId', auth.authenticate, async (req, res) => {
  const { executionId } = req.params;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  try {
    const eventStream = zipBridge.streamExecutionEvents(executionId);
    
    for await (const event of eventStream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (error) {
    logger.error('Streaming error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
  } finally {
    res.end();
  }
});

/**
 * OpenAI Assistant compatible endpoint
 * Handles tool calls in assistant format
 */
app.post('/assistant/tools', auth.authenticate, async (req, res) => {
  try {
    const { tool_calls } = req.body;
    
    if (!Array.isArray(tool_calls)) {
      return res.status(400).json({ 
        error: 'tool_calls must be an array' 
      });
    }

    const results = await Promise.all(
      tool_calls.map(async (toolCall) => {
        try {
          const args = typeof toolCall.function.arguments === 'string' 
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;
            
          const result = await functionHandler.execute(
            toolCall.function.name,
            args
          );
          
          return {
            tool_call_id: toolCall.id,
            output: JSON.stringify(result)
          };
        } catch (error) {
          return {
            tool_call_id: toolCall.id,
            output: JSON.stringify({ error: error.message })
          };
        }
      })
    );

    res.json({ tool_outputs: results });
  } catch (error) {
    logger.error('Assistant tool execution error:', error);
    res.status(500).json({ 
      error: 'Tool execution failed',
      details: error.message 
    });
  }
});

/**
 * Get metrics and usage statistics
 */
app.get('/metrics', auth.authenticate, async (req, res) => {
  const metrics = await functionHandler.getMetrics();
  res.json(metrics);
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`OpenAI Functions Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Zeal API: ${process.env.ZEAL_API_URL || 'http://localhost:3000'}`);
  logger.info(`Functions available: ${functionRegistry.getAllFunctions().length}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    zipBridge.dispose();
    process.exit(0);
  });
});

export default app;