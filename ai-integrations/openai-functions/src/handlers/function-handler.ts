/**
 * Function execution handler for OpenAI Functions
 */

import { Request, Response } from 'express';
import { FunctionRegistry } from '../functions/registry';
import { logger } from '../utils/logger';

export class FunctionHandler {
  constructor(private registry: FunctionRegistry) {}

  /**
   * Handle function execution request
   */
  async execute(req: Request, res: Response) {
    const { name, arguments: args } = req.body;

    if (!name) {
      return res.status(400).json({ 
        error: 'Function name is required' 
      });
    }

    try {
      logger.info(`Executing function: ${name}`, { args });
      
      // Execute the function
      const result = await this.registry.executeFunction(name, args || {});
      
      logger.info(`Function ${name} executed successfully`);
      
      return res.json({
        success: true,
        result
      });
    } catch (error) {
      logger.error(`Function execution failed: ${name}`, error);
      
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Function execution failed'
      });
    }
  }

  /**
   * List all available functions
   */
  async list(req: Request, res: Response) {
    try {
      const functions = this.registry.getAllFunctions();
      
      return res.json({
        functions: functions.map(fn => ({
          name: fn.name,
          description: fn.description,
          parameters: fn.parameters
        }))
      });
    } catch (error) {
      logger.error('Failed to list functions', error);
      
      return res.status(500).json({
        error: 'Failed to list functions'
      });
    }
  }

  /**
   * Get a specific function definition
   */
  async getFunction(req: Request, res: Response) {
    const { name } = req.params;

    try {
      const fn = this.registry.getFunction(name);
      
      if (!fn) {
        return res.status(404).json({
          error: `Function ${name} not found`
        });
      }

      return res.json({
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters
      });
    } catch (error) {
      logger.error(`Failed to get function: ${name}`, error);
      
      return res.status(500).json({
        error: 'Failed to get function'
      });
    }
  }
}