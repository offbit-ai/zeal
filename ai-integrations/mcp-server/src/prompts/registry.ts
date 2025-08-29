/**
 * Prompt registry for MCP server
 * Provides pre-defined prompts for common Zeal operations
 */

export interface PromptTemplate {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
  template: string;
}

export class PromptRegistry {
  private prompts: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.registerDefaultPrompts();
  }

  private registerDefaultPrompts() {
    this.register({
      name: 'create_workflow',
      description: 'Generate a workflow based on requirements',
      arguments: [
        {
          name: 'description',
          description: 'Description of what the workflow should do',
          required: true
        },
        {
          name: 'complexity',
          description: 'Complexity level: simple, moderate, or complex',
          required: false
        }
      ],
      template: `Create a Zeal workflow that {{description}}.
{{#if complexity}}The workflow should be {{complexity}} in complexity.{{/if}}

Requirements:
- Use appropriate node types for each task
- Ensure proper data flow between nodes
- Include error handling where necessary
- Optimize for performance and reliability`
    });

    this.register({
      name: 'optimize_workflow',
      description: 'Analyze and optimize an existing workflow',
      arguments: [
        {
          name: 'workflow_id',
          description: 'ID of the workflow to optimize',
          required: true
        },
        {
          name: 'focus',
          description: 'Optimization focus: performance, cost, or reliability',
          required: false
        }
      ],
      template: `Analyze workflow {{workflow_id}} and suggest optimizations.
{{#if focus}}Focus on improving {{focus}}.{{/if}}

Consider:
- Node consolidation opportunities
- Parallel processing potential
- Resource usage optimization
- Error handling improvements
- Performance bottlenecks`
    });

    this.register({
      name: 'debug_workflow',
      description: 'Debug issues in a workflow',
      arguments: [
        {
          name: 'workflow_id',
          description: 'ID of the workflow with issues',
          required: true
        },
        {
          name: 'error_description',
          description: 'Description of the error or issue',
          required: true
        }
      ],
      template: `Debug workflow {{workflow_id}} with the following issue:
{{error_description}}

Analyze:
- Node configurations and connections
- Data flow and transformations
- Error handling and edge cases
- Resource constraints
- Timing and synchronization issues`
    });
  }

  register(prompt: PromptTemplate) {
    this.prompts.set(prompt.name, prompt);
  }

  get(name: string): PromptTemplate | undefined {
    return this.prompts.get(name);
  }

  list(): PromptTemplate[] {
    return Array.from(this.prompts.values());
  }

  format(name: string, args: Record<string, any>): string {
    const prompt = this.get(name);
    if (!prompt) {
      throw new Error(`Prompt ${name} not found`);
    }

    let result = prompt.template;
    
    // Simple template replacement
    Object.entries(args).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    });

    // Handle conditionals (simplified)
    result = result.replace(/{{#if \w+}}.*?{{\/if}}/g, (match) => {
      const varName = match.match(/{{#if (\w+)}}/)?.[1];
      if (varName && args[varName]) {
        return match.replace(/{{#if \w+}}/, '').replace(/{{\/if}}/, '');
      }
      return '';
    });

    return result;
  }
}