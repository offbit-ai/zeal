/**
 * Resource provider for MCP server
 * Manages access to Zeal resources through MCP protocol
 */

import { ZIPBridge } from '../../../shared/zip-bridge';

export interface ResourceDescriptor {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export class ResourceProvider {
  constructor(private zipBridge: ZIPBridge) {}

  async list(): Promise<ResourceDescriptor[]> {
    try {
      // List available workflows as resources
      const workflows = await this.zipBridge.listWorkflows();
      
      return workflows.map(workflow => ({
        uri: `zeal://workflow/${workflow.id}`,
        name: workflow.name,
        description: workflow.description,
        mimeType: 'application/json'
      }));
    } catch (error) {
      console.error('Failed to list resources:', error);
      return [];
    }
  }

  async read(uri: string): Promise<string> {
    try {
      // Parse the URI to get resource type and ID
      const url = new URL(uri);
      const pathParts = url.pathname.split('/').filter(Boolean);
      
      if (pathParts[0] === 'workflow') {
        const workflowId = pathParts[1];
        const workflow = await this.zipBridge.getWorkflow(workflowId);
        return JSON.stringify(workflow, null, 2);
      }
      
      throw new Error(`Unknown resource type: ${pathParts[0]}`);
    } catch (error) {
      console.error('Failed to read resource:', error);
      throw error;
    }
  }
}