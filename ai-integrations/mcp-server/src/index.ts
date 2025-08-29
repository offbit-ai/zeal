/**
 * MCP Server for Zeal
 * Provides Model Context Protocol server for Claude (Desktop & API)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  ReadResourceRequestSchema,
  GetPromptRequestSchema,
  Tool,
  Resource,
  Prompt
} from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import { ZIPBridge } from '../../shared/zip-bridge';
import { ToolRegistry } from './tools/registry';
import { ResourceProvider } from './resources/provider';
import { PromptRegistry } from './prompts/registry';
import { logger } from './utils/logger';

config();

// Initialize ZIP Bridge
const zipBridge = new ZIPBridge({
  baseUrl: process.env.ZEAL_API_URL || 'http://localhost:3000',
  apiKey: process.env.ZEAL_API_KEY,
  namespace: 'mcp-server'
});

// Initialize LLM for AI features (optional)
let llm = null;
let embeddings = null;

// Check if OpenRouter API key is available for LLM features
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (OPENROUTER_API_KEY) {
  logger.info('🤖 LLM features enabled with OpenRouter');
  llm = {
    invoke: async (prompt: string) => {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/offbit-ai/zeal',
          'X-Title': 'Zeal MCP Server'
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku-20240307',
          messages: [
            {
              role: 'system',
              content: 'You are an AI assistant for workflow design and optimization. Always respond with valid JSON when requested.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 4000
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }
      
      const data = await response.json() as any;
      return data.choices[0].message.content;
    }
  };
} else {
  logger.info('⚠️ LLM features disabled. Set OPENROUTER_API_KEY to enable AI-powered features.');
  logger.info('📖 Basic template search and workflow operations will still work.');
}

// Initialize registries with optional LLM
const toolRegistry = new ToolRegistry(zipBridge, llm, embeddings);
const resourceProvider = new ResourceProvider(zipBridge);
const promptRegistry = new PromptRegistry();

// Create MCP Server
const server = new Server(
  {
    name: 'zeal-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {}
    }
  }
);

// ============= Tool Handlers =============

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = toolRegistry.getAllTools();
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    logger.info(`Executing tool: ${name}`, { tool: name, args });
    const result = await toolRegistry.executeTool(name, args);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Tool execution failed: ${name}`, error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ 
            error: error.message,
            tool: name 
          })
        }
      ],
      isError: true
    };
  }
});

// ============= Resource Handlers =============

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = await resourceProvider.list();
  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  try {
    logger.info(`Reading resource: ${uri}`);
    const content = await resourceProvider.read(uri);
    
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(content, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Resource read failed: ${uri}`, error);
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ 
            error: error.message,
            uri 
          })
        }
      ]
    };
  }
});

// ============= Prompt Handlers =============

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  const prompts = promptRegistry.list();
  return { prompts };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    logger.info(`Getting prompt: ${name}`, { prompt: name, args });
    const prompt = promptRegistry.get(name);
    if (!prompt) {
      throw new Error(`Prompt ${name} not found`);
    }
    const formatted = promptRegistry.format(name, args || {});
    const messages = [{
      role: 'user',
      content: {
        type: 'text',
        text: formatted
      }
    }];
    
    return { 
      description: `Generated prompt for ${name}`,
      messages 
    };
  } catch (error) {
    logger.error(`Prompt generation failed: ${name}`, error);
    return {
      description: `Error generating prompt for ${name}`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Error: ${error.message}`
          }
        }
      ]
    };
  }
});

// ============= Export for API Usage =============

/**
 * Extract tools for Claude API usage
 * Returns tool definitions in Claude API format
 */
export function extractToolsForAPI(): any[] {
  const tools = toolRegistry.getAllTools();
  
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema
  }));
}

/**
 * Execute a tool programmatically
 * For use with Claude API tool calls
 */
export async function executeTool(name: string, args: any): Promise<any> {
  return await toolRegistry.executeTool(name, args);
}

/**
 * Get all available resources
 * For context injection in Claude API
 */
export async function getResourcesForAPI(): Promise<any[]> {
  const resources = await resourceProvider.list();
  const resourceContents = [];
  
  for (const resource of resources) {
    try {
      const content = await resourceProvider.read(resource.uri);
      resourceContents.push({
        name: resource.name,
        description: resource.description,
        content
      });
    } catch (error) {
      logger.error(`Failed to read resource ${resource.uri}:`, error);
    }
  }
  
  return resourceContents;
}

/**
 * Generate a prompt with arguments
 * For use with Claude API
 */
export async function generatePrompt(name: string, args: any): Promise<string> {
  const prompt = promptRegistry.get(name);
  if (!prompt) {
    throw new Error(`Prompt ${name} not found`);
  }
  return promptRegistry.format(name, args || {});
}

// ============= Server Startup =============

async function startServer() {
  const transport = process.env.MCP_TRANSPORT || 'stdio';
  
  if (transport === 'stdio') {
    // For Claude Desktop or CLI usage
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('MCP Server started with stdio transport');
  } else if (transport === 'http') {
    // For HTTP/API usage
    const express = await import('express');
    const app = express.default();
    
    app.use(express.default.json());
    
    // Tool extraction endpoint
    app.get('/tools', (req, res) => {
      res.json(extractToolsForAPI());
    });
    
    // Tool execution endpoint
    app.post('/tools/:name/execute', async (req, res) => {
      try {
        const result = await executeTool(req.params.name, req.body);
        res.json({ result });
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
      }
    });
    
    // Resources endpoint
    app.get('/resources', async (req, res) => {
      const resources = await getResourcesForAPI();
      res.json(resources);
    });
    
    // Prompts endpoint
    app.get('/prompts/:name', async (req: any, res: any) => {
      try {
        const prompt = await generatePrompt(req.params.name, req.query);
        res.json({ prompt });
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
      }
    });
    
    const PORT = process.env.PORT || 3457;
    app.listen(PORT, () => {
      logger.info(`MCP Server HTTP API running on port ${PORT}`);
    });
  } else {
    logger.error(`Unknown transport: ${transport}`);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error('Failed to start MCP server:', error as Error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await zipBridge.dispose();
  process.exit(0);
});