#!/usr/bin/env node

/**
 * Migration runner for Zeal Authorization Framework
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  schema?: string;
}

class MigrationRunner {
  private pool: Pool;
  private schema: string;
  
  constructor(config: MigrationConfig) {
    this.schema = config.schema || 'zeal_auth';
    
    if (config.connectionString) {
      this.pool = new Pool({ connectionString: config.connectionString });
    } else {
      this.pool = new Pool({
        host: config.host || process.env.POSTGRES_HOST || 'localhost',
        port: config.port || parseInt(process.env.POSTGRES_PORT || '5432'),
        database: config.database || process.env.POSTGRES_DB || 'zeal',
        user: config.user || process.env.POSTGRES_USER || 'postgres',
        password: config.password || process.env.POSTGRES_PASSWORD
      });
    }
  }
  
  /**
   * Run all pending migrations
   */
  async run(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Create migrations table if not exists
      await this.createMigrationsTable(client);
      
      // Get applied migrations
      const applied = await this.getAppliedMigrations(client);
      
      // Get migration files
      const migrations = await this.getMigrationFiles();
      
      // Run pending migrations
      for (const migration of migrations) {
        if (!applied.includes(migration.name)) {
          console.log(`Running migration: ${migration.name}`);
          await this.runMigration(client, migration);
          console.log(`✓ Completed: ${migration.name}`);
        } else {
          console.log(`✓ Already applied: ${migration.name}`);
        }
      }
      
      // Commit transaction
      await client.query('COMMIT');
      console.log('\n✓ All migrations completed successfully');
      
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      console.error('Migration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Rollback last migration
   */
  async rollback(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get last applied migration
      const result = await client.query(`
        SELECT name, rollback_sql 
        FROM ${this.schema}.migrations 
        ORDER BY applied_at DESC 
        LIMIT 1
      `);
      
      if (result.rows.length === 0) {
        console.log('No migrations to rollback');
        return;
      }
      
      const migration = result.rows[0];
      console.log(`Rolling back: ${migration.name}`);
      
      // Execute rollback SQL if exists
      if (migration.rollback_sql) {
        await client.query(migration.rollback_sql);
      }
      
      // Remove from migrations table
      await client.query(`
        DELETE FROM ${this.schema}.migrations 
        WHERE name = $1
      `, [migration.name]);
      
      await client.query('COMMIT');
      console.log(`✓ Rolled back: ${migration.name}`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Rollback failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Reset database (drop and recreate schema)
   */
  async reset(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      console.log(`Dropping schema ${this.schema}...`);
      await client.query(`DROP SCHEMA IF EXISTS ${this.schema} CASCADE`);
      
      console.log(`Creating schema ${this.schema}...`);
      await client.query(`CREATE SCHEMA ${this.schema}`);
      
      console.log('✓ Schema reset complete');
      
      // Run all migrations
      await this.run();
      
    } catch (error) {
      console.error('Reset failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Create migrations tracking table
   */
  private async createMigrationsTable(client: any): Promise<void> {
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS ${this.schema};
      
      CREATE TABLE IF NOT EXISTS ${this.schema}.migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64),
        rollback_sql TEXT
      );
    `);
  }
  
  /**
   * Get list of applied migrations
   */
  private async getAppliedMigrations(client: any): Promise<string[]> {
    const result = await client.query(`
      SELECT name FROM ${this.schema}.migrations 
      ORDER BY applied_at
    `);
    
    return result.rows.map((row: any) => row.name);
  }
  
  /**
   * Get migration files from directory
   */
  private async getMigrationFiles(): Promise<Array<{
    name: string;
    path: string;
    sql: string;
  }>> {
    const migrationsDir = path.join(__dirname);
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    return files.map(file => ({
      name: file,
      path: path.join(migrationsDir, file),
      sql: fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
    }));
  }
  
  /**
   * Run a single migration
   */
  private async runMigration(
    client: any, 
    migration: { name: string; sql: string }
  ): Promise<void> {
    // Execute migration SQL
    await client.query(migration.sql);
    
    // Calculate checksum
    const crypto = await import('crypto');
    const checksum = crypto
      .createHash('sha256')
      .update(migration.sql)
      .digest('hex');
    
    // Record migration
    await client.query(`
      INSERT INTO ${this.schema}.migrations (name, checksum) 
      VALUES ($1, $2)
    `, [migration.name, checksum]);
  }
  
  /**
   * Close connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Parse configuration from environment or arguments
  const config: MigrationConfig = {
    connectionString: process.env.DATABASE_URL,
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : undefined,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    schema: process.env.AUTH_SCHEMA || 'zeal_auth'
  };
  
  const runner = new MigrationRunner(config);
  
  try {
    switch (command) {
      case 'up':
      case 'migrate':
        await runner.run();
        break;
        
      case 'down':
      case 'rollback':
        await runner.rollback();
        break;
        
      case 'reset':
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        await new Promise<void>((resolve) => {
          rl.question('⚠️  This will DELETE all data. Are you sure? (yes/no): ', (answer) => {
            rl.close();
            if (answer.toLowerCase() === 'yes') {
              resolve();
            } else {
              console.log('Reset cancelled');
              process.exit(0);
            }
          });
        });
        
        await runner.reset();
        break;
        
      default:
        console.log(`
Zeal Authorization Framework Migration Runner

Usage:
  npm run migrate:up       Run all pending migrations
  npm run migrate:down     Rollback last migration
  npm run migrate:reset    Reset database (WARNING: Deletes all data)

Environment variables:
  DATABASE_URL      PostgreSQL connection string
  POSTGRES_HOST     Database host (default: localhost)
  POSTGRES_PORT     Database port (default: 5432)
  POSTGRES_DB       Database name (default: zeal)
  POSTGRES_USER     Database user (default: postgres)
  POSTGRES_PASSWORD Database password
  AUTH_SCHEMA       Schema name (default: zeal_auth)
        `);
        process.exit(0);
    }
    
    await runner.close();
    process.exit(0);
    
  } catch (error) {
    console.error('Migration error:', error);
    await runner.close();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { MigrationRunner };
export type { MigrationConfig };