/**
 * TimescaleDB Configuration for Flow Traces
 * Separate database connection for time-series data
 */

import { Pool, PoolConfig } from 'pg'

// TimescaleDB connection configuration
export const getTimescaleDBConfig = (): PoolConfig => {
  const config: PoolConfig = {
    host: process.env.TIMESCALE_HOST || process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.TIMESCALE_PORT || process.env.POSTGRES_PORT || '5432'),
    database: process.env.TIMESCALE_DATABASE || 'zeal_traces',
    user: process.env.TIMESCALE_USER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.TIMESCALE_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    
    // Connection pool settings optimized for time-series workloads
    max: parseInt(process.env.TIMESCALE_POOL_MAX || '20'), // More connections for high-volume writes
    min: parseInt(process.env.TIMESCALE_POOL_MIN || '5'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    
    // Statement timeout for long-running aggregation queries
    statement_timeout: parseInt(process.env.TIMESCALE_STATEMENT_TIMEOUT || '30000'),
    
    // Application name for monitoring
    application_name: 'zeal-flow-traces',
  }
  
  // SSL configuration for production
  if (process.env.NODE_ENV === 'production' && process.env.TIMESCALE_SSL !== 'false') {
    config.ssl = {
      rejectUnauthorized: process.env.TIMESCALE_SSL_REJECT_UNAUTHORIZED !== 'false'
    }
  }
  
  return config
}

// Singleton pool instance
let timescalePool: Pool | null = null

/**
 * Get or create TimescaleDB connection pool
 */
export const getTimescaleDB = async (): Promise<Pool> => {
  if (!timescalePool) {
    const config = getTimescaleDBConfig()
    timescalePool = new Pool(config)
    
    // Test connection
    try {
      const client = await timescalePool.connect()
      
      // Verify TimescaleDB is enabled
      const result = await client.query(`
        SELECT default_version, installed_version 
        FROM pg_available_extensions 
        WHERE name = 'timescaledb'
      `)
      
      if (result.rows.length > 0 && result.rows[0].installed_version) {
        console.log(`Connected to TimescaleDB v${result.rows[0].installed_version}`)
      } else {
        console.warn('TimescaleDB extension not installed - time-series features will be limited')
      }
      
      client.release()
    } catch (error) {
      console.error('Failed to connect to TimescaleDB:', error)
      throw error
    }
    
    // Handle pool errors
    timescalePool.on('error', (err) => {
      console.error('Unexpected TimescaleDB pool error:', err)
    })
  }
  
  return timescalePool
}

/**
 * Close TimescaleDB connection pool
 */
export const closeTimescaleDB = async (): Promise<void> => {
  if (timescalePool) {
    await timescalePool.end()
    timescalePool = null
  }
}

/**
 * Execute a query with automatic retry for transient errors
 */
export async function executeWithRetry<T>(
  query: string,
  params: any[] = [],
  maxRetries = 3
): Promise<T> {
  const pool = await getTimescaleDB()
  let lastError: Error | null = null
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await pool.query(query, params)
      return result as T
    } catch (error: any) {
      lastError = error
      
      // Don't retry for non-transient errors
      if (error.code && !isTransientError(error.code)) {
        throw error
      }
      
      // Exponential backoff
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100))
      }
    }
  }
  
  throw lastError || new Error('Query failed after retries')
}

/**
 * Check if an error is transient and should be retried
 */
function isTransientError(code: string): boolean {
  const transientCodes = [
    '40001', // serialization_failure
    '40P01', // deadlock_detected
    '55P03', // lock_not_available
    '57P03', // cannot_connect_now
    '08006', // connection_failure
    '08001', // sqlclient_unable_to_establish_sqlconnection
    '08004', // sqlserver_rejected_establishment_of_sqlconnection
  ]
  
  return transientCodes.includes(code)
}

/**
 * Health check for TimescaleDB connection
 */
export async function checkTimescaleHealth(): Promise<{
  connected: boolean
  version?: string
  hypertables?: number
  compressionEnabled?: boolean
  continuousAggregates?: number
}> {
  try {
    const pool = await getTimescaleDB()
    const client = await pool.connect()
    
    try {
      // Check basic connectivity
      await client.query('SELECT 1')
      
      // Get TimescaleDB version
      const versionResult = await client.query(`
        SELECT extversion as version 
        FROM pg_extension 
        WHERE extname = 'timescaledb'
      `)
      
      // Count hypertables
      const hypertablesResult = await client.query(`
        SELECT COUNT(*) as count 
        FROM timescaledb_information.hypertables
      `)
      
      // Check compression
      const compressionResult = await client.query(`
        SELECT COUNT(*) as count 
        FROM timescaledb_information.compression_settings
      `)
      
      // Count continuous aggregates
      const aggregatesResult = await client.query(`
        SELECT COUNT(*) as count 
        FROM timescaledb_information.continuous_aggregates
      `)
      
      return {
        connected: true,
        version: versionResult.rows[0]?.version,
        hypertables: parseInt(hypertablesResult.rows[0]?.count || '0'),
        compressionEnabled: parseInt(compressionResult.rows[0]?.count || '0') > 0,
        continuousAggregates: parseInt(aggregatesResult.rows[0]?.count || '0'),
      }
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('TimescaleDB health check failed:', error)
    return { connected: false }
  }
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    closeTimescaleDB().catch(console.error)
  })
}