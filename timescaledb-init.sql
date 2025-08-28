-- TimescaleDB Schema for Zeal Flow Traces
-- Optimized for time-series data with retention policies and time travel capabilities

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- FLOW TRACE TABLES (TIME-SERIES OPTIMIZED)
-- ============================================================================

-- Flow trace sessions table - tracks workflow execution sessions
CREATE TABLE IF NOT EXISTS flow_trace_sessions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  workflow_version_id TEXT,
  workflow_name TEXT NOT NULL,
  execution_id TEXT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  summary JSONB,
  metadata JSONB,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('flow_trace_sessions', 'start_time', 
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Flow traces table - individual trace events
CREATE TABLE IF NOT EXISTS flow_traces (
  id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration INTEGER NOT NULL, -- milliseconds
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'warning')),
  
  -- Source node information
  source_node_id TEXT NOT NULL,
  source_node_name TEXT NOT NULL,
  source_node_type TEXT NOT NULL,
  source_port_id TEXT NOT NULL,
  source_port_name TEXT NOT NULL,
  source_port_type TEXT NOT NULL CHECK (source_port_type IN ('input', 'output')),
  
  -- Target node information  
  target_node_id TEXT NOT NULL,
  target_node_name TEXT NOT NULL,
  target_node_type TEXT NOT NULL,
  target_port_id TEXT NOT NULL,
  target_port_name TEXT NOT NULL,
  target_port_type TEXT NOT NULL CHECK (target_port_type IN ('input', 'output')),
  
  -- Data payload
  data_payload JSONB,
  data_size INTEGER NOT NULL, -- bytes
  data_type TEXT NOT NULL,
  data_preview TEXT,
  
  -- Error information
  error_message TEXT,
  error_code TEXT,
  error_stack TEXT,
  
  -- Subgraph support
  graph_id TEXT,
  graph_name TEXT,
  parent_trace_id TEXT,
  depth INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Composite primary key for better partitioning
  PRIMARY KEY (timestamp, id)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('flow_traces', 'timestamp',
  chunk_time_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- Flow trace events table - for individual node events (more granular than traces)
CREATE TABLE IF NOT EXISTS flow_trace_events (
  id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  node_id TEXT NOT NULL,
  port_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('input', 'output', 'error', 'log', 'start', 'complete')),
  data JSONB,
  duration INTEGER, -- milliseconds
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (timestamp, id)
);

-- Convert to hypertable
SELECT create_hypertable('flow_trace_events', 'timestamp',
  chunk_time_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Sessions indexes
CREATE INDEX idx_flow_trace_sessions_workflow_id ON flow_trace_sessions(workflow_id, start_time DESC);
CREATE INDEX idx_flow_trace_sessions_status ON flow_trace_sessions(status, start_time DESC);
CREATE INDEX idx_flow_trace_sessions_user_id ON flow_trace_sessions(user_id, start_time DESC);
CREATE INDEX idx_flow_trace_sessions_execution_id ON flow_trace_sessions(execution_id) WHERE execution_id IS NOT NULL;

-- Traces indexes
CREATE INDEX idx_flow_traces_session_id ON flow_traces(session_id, timestamp DESC);
CREATE INDEX idx_flow_traces_status ON flow_traces(status, timestamp DESC);
CREATE INDEX idx_flow_traces_graph_id ON flow_traces(graph_id, timestamp DESC) WHERE graph_id IS NOT NULL;
CREATE INDEX idx_flow_traces_parent_trace ON flow_traces(parent_trace_id, timestamp DESC) WHERE parent_trace_id IS NOT NULL;
CREATE INDEX idx_flow_traces_source_node ON flow_traces(source_node_id, timestamp DESC);
CREATE INDEX idx_flow_traces_target_node ON flow_traces(target_node_id, timestamp DESC);

-- Events indexes
CREATE INDEX idx_flow_trace_events_session_id ON flow_trace_events(session_id, timestamp DESC);
CREATE INDEX idx_flow_trace_events_node_id ON flow_trace_events(node_id, timestamp DESC);
CREATE INDEX idx_flow_trace_events_type ON flow_trace_events(event_type, timestamp DESC);

-- ============================================================================
-- CONTINUOUS AGGREGATES FOR REAL-TIME ANALYTICS
-- ============================================================================

-- Hourly session statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS session_stats_hourly
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 hour', start_time) AS hour,
  workflow_id,
  COUNT(*) as session_count,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
  AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)::INTEGER as avg_duration_ms,
  MIN(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)::INTEGER as min_duration_ms,
  MAX(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)::INTEGER as max_duration_ms
FROM flow_trace_sessions
WHERE end_time IS NOT NULL
GROUP BY hour, workflow_id
WITH NO DATA;

-- Daily session statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS session_stats_daily
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 day', start_time) AS day,
  workflow_id,
  COUNT(*) as session_count,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
  AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)::INTEGER as avg_duration_ms
FROM flow_trace_sessions
WHERE end_time IS NOT NULL
GROUP BY day, workflow_id
WITH NO DATA;

-- Node performance statistics (hourly)
CREATE MATERIALIZED VIEW IF NOT EXISTS node_performance_hourly
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 hour', timestamp) AS hour,
  target_node_id,
  target_node_name,
  target_node_type,
  COUNT(*) as execution_count,
  AVG(duration) as avg_duration,
  MIN(duration) as min_duration,
  MAX(duration) as max_duration,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count,
  AVG(data_size) as avg_data_size
FROM flow_traces
GROUP BY hour, target_node_id, target_node_name, target_node_type
WITH NO DATA;

-- Refresh policies for continuous aggregates
SELECT add_continuous_aggregate_policy('session_stats_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '30 minutes',
  if_not_exists => TRUE
);

SELECT add_continuous_aggregate_policy('session_stats_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

SELECT add_continuous_aggregate_policy('node_performance_hourly',
  start_offset => INTERVAL '2 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '30 minutes',
  if_not_exists => TRUE
);

-- ============================================================================
-- RETENTION POLICIES
-- ============================================================================

-- Keep detailed traces for 30 days
SELECT add_retention_policy('flow_traces', 
  INTERVAL '30 days',
  if_not_exists => TRUE
);

-- Keep trace events for 7 days (more granular, shorter retention)
SELECT add_retention_policy('flow_trace_events',
  INTERVAL '7 days',
  if_not_exists => TRUE
);

-- Keep sessions for 90 days
SELECT add_retention_policy('flow_trace_sessions',
  INTERVAL '90 days',
  if_not_exists => TRUE
);

-- ============================================================================
-- COMPRESSION POLICIES
-- ============================================================================

-- Compress chunks older than 7 days for traces
SELECT add_compression_policy('flow_traces', 
  INTERVAL '7 days',
  if_not_exists => TRUE
);

-- Compress chunks older than 3 days for events
SELECT add_compression_policy('flow_trace_events',
  INTERVAL '3 days',
  if_not_exists => TRUE
);

-- Compress chunks older than 14 days for sessions
SELECT add_compression_policy('flow_trace_sessions',
  INTERVAL '14 days',
  if_not_exists => TRUE
);

-- ============================================================================
-- TIME TRAVEL FUNCTIONS
-- ============================================================================

-- Function to get workflow state at a specific point in time
CREATE OR REPLACE FUNCTION get_workflow_state_at(
  p_workflow_id TEXT,
  p_timestamp TIMESTAMPTZ
)
RETURNS TABLE (
  session_id TEXT,
  session_status TEXT,
  nodes_executed INTEGER,
  last_node_id TEXT,
  last_node_name TEXT,
  errors_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as session_id,
    s.status as session_status,
    COUNT(DISTINCT t.target_node_id)::INTEGER as nodes_executed,
    (SELECT target_node_id FROM flow_traces 
     WHERE session_id = s.id AND timestamp <= p_timestamp 
     ORDER BY timestamp DESC LIMIT 1) as last_node_id,
    (SELECT target_node_name FROM flow_traces 
     WHERE session_id = s.id AND timestamp <= p_timestamp 
     ORDER BY timestamp DESC LIMIT 1) as last_node_name,
    COUNT(CASE WHEN t.status = 'error' THEN 1 END)::INTEGER as errors_count
  FROM flow_trace_sessions s
  LEFT JOIN flow_traces t ON s.id = t.session_id AND t.timestamp <= p_timestamp
  WHERE s.workflow_id = p_workflow_id
    AND s.start_time <= p_timestamp
    AND (s.end_time IS NULL OR s.end_time >= p_timestamp)
  GROUP BY s.id, s.status;
END;
$$ LANGUAGE plpgsql;

-- Function to replay traces between two timestamps
CREATE OR REPLACE FUNCTION replay_traces(
  p_session_id TEXT,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ
)
RETURNS TABLE (
  trace_id TEXT,
  timestamp TIMESTAMPTZ,
  duration INTEGER,
  status TEXT,
  source_node TEXT,
  target_node TEXT,
  data_size INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id as trace_id,
    flow_traces.timestamp,
    flow_traces.duration,
    flow_traces.status,
    source_node_name as source_node,
    target_node_name as target_node,
    data_size
  FROM flow_traces
  WHERE session_id = p_session_id
    AND flow_traces.timestamp >= p_start_time
    AND flow_traces.timestamp <= p_end_time
  ORDER BY flow_traces.timestamp;
END;
$$ LANGUAGE plpgsql;

-- Function to get execution timeline
CREATE OR REPLACE FUNCTION get_execution_timeline(
  p_session_id TEXT,
  p_interval_seconds INTEGER DEFAULT 1
)
RETURNS TABLE (
  time_bucket TIMESTAMPTZ,
  active_nodes INTEGER,
  data_processed BIGINT,
  errors INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    time_bucket(make_interval(secs => p_interval_seconds), timestamp) as time_bucket,
    COUNT(DISTINCT target_node_id)::INTEGER as active_nodes,
    SUM(data_size)::BIGINT as data_processed,
    COUNT(CASE WHEN status = 'error' THEN 1 END)::INTEGER as errors
  FROM flow_traces
  WHERE session_id = p_session_id
  GROUP BY time_bucket
  ORDER BY time_bucket;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_flow_trace_sessions_updated_at
  BEFORE UPDATE ON flow_trace_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PERMISSIONS (adjust for your security model)
-- ============================================================================

-- Create read-only role for analytics
CREATE ROLE flowtrace_reader;
GRANT USAGE ON SCHEMA public TO flowtrace_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO flowtrace_reader;

-- Create write role for applications
CREATE ROLE flowtrace_writer;
GRANT USAGE ON SCHEMA public TO flowtrace_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO flowtrace_writer;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO flowtrace_writer;

-- Comments for documentation
COMMENT ON TABLE flow_trace_sessions IS 'Stores workflow execution sessions with time-series optimization';
COMMENT ON TABLE flow_traces IS 'Stores individual trace events between nodes with automatic retention';
COMMENT ON TABLE flow_trace_events IS 'Stores granular node events with shorter retention period';
COMMENT ON MATERIALIZED VIEW session_stats_hourly IS 'Hourly aggregated session statistics for real-time dashboards';
COMMENT ON MATERIALIZED VIEW node_performance_hourly IS 'Hourly node performance metrics for optimization';