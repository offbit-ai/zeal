/**
 * Unified AI Example
 * Demonstrates using both OpenAI Functions and MCP servers together
 * for comprehensive AI-powered workflow orchestration
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';

// Configuration
const OPENAI_FUNCTIONS_URL = 'http://localhost:3456';
const MCP_SERVER_URL = 'http://localhost:3457';
const ZEAL_API_KEY = process.env.ZEAL_API_KEY || 'your-api-key';

// Initialize AI clients
const openai = new OpenAI();
const anthropic = new Anthropic();

/**
 * Fetch tools from both servers
 */
async function fetchAllTools() {
  const [openaiTools, mcpTools] = await Promise.all([
    axios.get(`${OPENAI_FUNCTIONS_URL}/tools`, {
      headers: { 'X-API-Key': ZEAL_API_KEY }
    }),
    axios.get(`${MCP_SERVER_URL}/tools`, {
      headers: { 'X-API-Key': ZEAL_API_KEY }
    })
  ]);

  return {
    openai: openaiTools.data,
    mcp: mcpTools.data
  };
}

/**
 * Execute a function/tool via the appropriate server
 */
async function executeFunction(
  server: 'openai' | 'mcp',
  name: string,
  args: any
) {
  const url = server === 'openai'
    ? `${OPENAI_FUNCTIONS_URL}/functions/execute`
    : `${MCP_SERVER_URL}/tools/${name}/execute`;
    
  const response = await axios.post(url, 
    server === 'openai' ? { name, arguments: args } : args,
    { headers: { 'X-API-Key': ZEAL_API_KEY } }
  );
  
  return response.data.result;
}

/**
 * Example 1: Use GPT-4 for workflow creation and Claude for optimization
 */
async function collaborativeWorkflowDesign() {
  console.log('=== Collaborative Workflow Design ===\n');
  
  // Step 1: Use GPT-4 to create initial workflow
  console.log('Step 1: Creating workflow with GPT-4...');
  
  const tools = await fetchAllTools();
  
  const gptResponse = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: 'You are a workflow designer. Create efficient data processing workflows.'
      },
      {
        role: 'user',
        content: 'Create a workflow for processing customer orders: validate, enrich with customer data, calculate totals, and update inventory.'
      }
    ],
    tools: tools.openai,
    tool_choice: 'auto'
  });

  let workflowId: string | null = null;
  
  // Process GPT tool calls
  if (gptResponse.choices[0].message.tool_calls) {
    for (const toolCall of gptResponse.choices[0].message.tool_calls) {
      const result = await executeFunction(
        'openai',
        toolCall.function.name,
        JSON.parse(toolCall.function.arguments)
      );
      
      if (toolCall.function.name === 'create_workflow') {
        workflowId = result.id;
        console.log(`Workflow created with ID: ${workflowId}`);
      }
    }
  }
  
  // Step 2: Use Claude to optimize the workflow
  if (workflowId) {
    console.log('\nStep 2: Optimizing workflow with Claude...');
    
    const claudeResponse = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Optimize workflow ${workflowId} for maximum performance and reliability. Focus on parallel processing where possible.`
        }
      ],
      tools: tools.mcp.filter(t => t.name === 'workflow_optimize'),
      tool_choice: { type: 'any' }
    });
    
    for (const content of claudeResponse.content) {
      if (content.type === 'tool_use') {
        const result = await executeFunction('mcp', content.name, {
          ...content.input,
          workflow_id: workflowId
        });
        console.log('Optimization suggestions:', result.suggestions);
      }
    }
  }
  
  return workflowId;
}

/**
 * Example 2: Use both AIs for comprehensive debugging
 */
async function collaborativeDebugging(executionId: string) {
  console.log('\n=== Collaborative Debugging ===\n');
  
  const tools = await fetchAllTools();
  
  // Use Claude for initial analysis
  console.log('Claude analyzing execution...');
  const claudeAnalysis = await anthropic.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `Debug execution ${executionId} and identify root causes of failure.`
      }
    ],
    tools: tools.mcp.filter(t => t.name === 'debug_execution'),
    tool_choice: { type: 'any' }
  });
  
  // Use GPT-4 for solution generation
  console.log('GPT-4 generating solutions...');
  const gptSolution = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: 'You are debugging expert. Provide specific fixes for workflow issues.'
      },
      {
        role: 'user',
        content: `Based on this analysis: ${JSON.stringify(claudeAnalysis.content)}, provide specific node configurations to fix the issues.`
      }
    ],
    tools: tools.openai.filter(t => 
      t.function.name.includes('update_node') || 
      t.function.name.includes('add_node')
    )
  });
  
  console.log('Debug analysis complete');
}

/**
 * Example 3: Parallel workflow generation
 */
async function parallelWorkflowGeneration() {
  console.log('\n=== Parallel Workflow Generation ===\n');
  
  const requirements = [
    'ETL pipeline for daily sales data',
    'Real-time fraud detection system',
    'Customer segmentation workflow'
  ];
  
  // Generate workflows in parallel using both AIs
  const results = await Promise.all([
    // GPT-4 handles first two
    ...requirements.slice(0, 2).map(async (req) => {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'user', content: `Create workflow: ${req}` }
        ],
        tools: await fetchAllTools().then(t => t.openai),
        tool_choice: 'auto'
      });
      return { ai: 'GPT-4', requirement: req, response };
    }),
    
    // Claude handles the third
    (async () => {
      const response = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [
          { role: 'user', content: `Create workflow: ${requirements[2]}` }
        ],
        tools: await fetchAllTools().then(t => t.mcp),
        tool_choice: { type: 'auto' }
      });
      return { ai: 'Claude', requirement: requirements[2], response };
    })()
  ]);
  
  console.log('Generated workflows:');
  results.forEach(r => {
    console.log(`- ${r.requirement} (by ${r.ai})`);
  });
}

/**
 * Example 4: AI Agent Collaboration Pattern
 */
class AIOrchestrator {
  private openaiTools: any[];
  private mcpTools: any[];
  
  async initialize() {
    const tools = await fetchAllTools();
    this.openaiTools = tools.openai;
    this.mcpTools = tools.mcp;
  }
  
  /**
   * Delegate tasks to the most appropriate AI
   */
  async delegateTask(task: {
    type: 'create' | 'optimize' | 'debug' | 'analyze';
    description: string;
    context?: any;
  }) {
    switch (task.type) {
      case 'create':
        // GPT-4 is better at creating from scratch
        return this.useGPT4(task.description, task.context);
        
      case 'optimize':
      case 'analyze':
        // Claude excels at analysis and optimization
        return this.useClaude(task.description, task.context);
        
      case 'debug':
        // Use both for comprehensive debugging
        const [gptDebug, claudeDebug] = await Promise.all([
          this.useGPT4(task.description, task.context),
          this.useClaude(task.description, task.context)
        ]);
        return { gpt: gptDebug, claude: claudeDebug };
        
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }
  
  private async useGPT4(prompt: string, context?: any) {
    return openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are a workflow automation expert.' },
        { role: 'user', content: prompt }
      ],
      tools: this.openaiTools,
      tool_choice: 'auto'
    });
  }
  
  private async useClaude(prompt: string, context?: any) {
    return anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: prompt }
      ],
      tools: this.mcpTools,
      tool_choice: { type: 'auto' }
    });
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Example 1: Collaborative workflow design
    const workflowId = await collaborativeWorkflowDesign();
    
    // Example 2: Collaborative debugging (with mock execution ID)
    await collaborativeDebugging('exec_mock_123');
    
    // Example 3: Parallel generation
    await parallelWorkflowGeneration();
    
    // Example 4: Using the orchestrator
    console.log('\n=== AI Orchestrator Pattern ===\n');
    const orchestrator = new AIOrchestrator();
    await orchestrator.initialize();
    
    const result = await orchestrator.delegateTask({
      type: 'create',
      description: 'Build a data validation pipeline'
    });
    
    console.log('Orchestrator completed task');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  fetchAllTools,
  executeFunction,
  collaborativeWorkflowDesign,
  collaborativeDebugging,
  parallelWorkflowGeneration,
  AIOrchestrator
};