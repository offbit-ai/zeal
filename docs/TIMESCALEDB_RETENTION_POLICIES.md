# TimescaleDB Retention Policy Configuration

## Overview

Zeal uses TimescaleDB to store flow trace data with automatic retention policies. This allows you to control how long different types of trace data are kept before being automatically deleted, helping manage storage costs and comply with data retention requirements.

## Default Retention Periods

By default, Zeal configures the following retention periods:

- **Flow Traces**: 30 days - Detailed trace data between nodes
- **Trace Events**: 7 days - Granular node execution events  
- **Sessions**: 90 days - Session-level aggregated data

## Configuration Methods

### 1. Environment Variables

Set these environment variables before starting Zeal:

```bash
# PostgreSQL interval format (e.g., "30 days", "6 months", "1 year")
export TIMESCALE_RETENTION_FLOW_TRACES="30 days"
export TIMESCALE_RETENTION_TRACE_EVENTS="7 days"  
export TIMESCALE_RETENTION_SESSIONS="90 days"
```

### 2. Docker Compose

When using Docker Compose, add the retention variables to your `.env` file:

```env
TIMESCALE_RETENTION_FLOW_TRACES=30 days
TIMESCALE_RETENTION_TRACE_EVENTS=7 days
TIMESCALE_RETENTION_SESSIONS=90 days
```

Or use the TimescaleDB overlay:

```bash
docker-compose -f docker-compose.yml -f docker-compose.timescaledb.yml up
```

### 3. Development Environment

The `start-dev.sh` script automatically applies retention policies:

```bash
# Use default retention periods
./start-dev.sh

# Or set custom retention periods
export TIMESCALE_RETENTION_FLOW_TRACES="60 days"
export TIMESCALE_RETENTION_TRACE_EVENTS="14 days"
export TIMESCALE_RETENTION_SESSIONS="180 days"
./start-dev.sh
```

### 4. Kubernetes Deployment

For Kubernetes deployments, configure retention in the ConfigMap:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: timescaledb-config
data:
  TIMESCALE_RETENTION_FLOW_TRACES: "30 days"
  TIMESCALE_RETENTION_TRACE_EVENTS: "7 days"
  TIMESCALE_RETENTION_SESSIONS: "90 days"
```

Or set during deployment:

```bash
# K3s deployment
export TIMESCALE_RETENTION_FLOW_TRACES="45 days"
./deployments/k3s/deploy.sh

# AWS EKS deployment  
export TIMESCALE_RETENTION_SESSIONS="120 days"
./deployments/aws/deploy.sh
```

### 5. Manual Configuration

To manually update retention policies on a running TimescaleDB instance:

```bash
# Using the configuration script
./scripts/configure-timescale-retention.sh

# Or directly via SQL
psql -U zeal_user -d zeal_traces <<SQL
-- Remove old policy
SELECT remove_retention_policy('flow_traces', if_exists => TRUE);

-- Add new policy
SELECT add_retention_policy('flow_traces', 
  INTERVAL '45 days',
  if_not_exists => TRUE
);
SQL
```

## Retention Period Guidelines

### Recommended Settings by Use Case

#### Development/Testing
```env
TIMESCALE_RETENTION_FLOW_TRACES=7 days
TIMESCALE_RETENTION_TRACE_EVENTS=3 days
TIMESCALE_RETENTION_SESSIONS=30 days
```

#### Production - Standard
```env
TIMESCALE_RETENTION_FLOW_TRACES=30 days
TIMESCALE_RETENTION_TRACE_EVENTS=7 days
TIMESCALE_RETENTION_SESSIONS=90 days
```

#### Production - Compliance/Audit
```env
TIMESCALE_RETENTION_FLOW_TRACES=90 days
TIMESCALE_RETENTION_TRACE_EVENTS=30 days
TIMESCALE_RETENTION_SESSIONS=365 days
```

#### Production - Cost-Optimized
```env
TIMESCALE_RETENTION_FLOW_TRACES=14 days
TIMESCALE_RETENTION_TRACE_EVENTS=3 days
TIMESCALE_RETENTION_SESSIONS=30 days
```

## Valid Interval Formats

TimescaleDB accepts PostgreSQL interval formats:

- Days: `'7 days'`, `'30 days'`
- Weeks: `'2 weeks'`, `'4 weeks'`
- Months: `'1 month'`, `'6 months'`
- Years: `'1 year'`, `'2 years'`
- Combined: `'1 year 6 months'`, `'3 months 15 days'`

## Viewing Current Retention Policies

To check the currently configured retention policies:

```sql
SELECT 
  hypertable_name,
  config::json->>'drop_after' as retention_period
FROM timescaledb_information.jobs 
WHERE proc_name = 'policy_retention'
ORDER BY hypertable_name;
```

Or use the script:

```bash
./scripts/configure-timescale-retention.sh --show-only
```

## Storage Considerations

### Estimating Storage Requirements

Approximate storage per day (varies by usage):
- Flow traces: ~100MB-1GB per 10,000 workflow executions
- Trace events: ~50MB-500MB per 10,000 workflow executions  
- Sessions: ~10MB-100MB per 10,000 workflow executions

### Example Calculations

For 1,000 daily workflow executions:
- 30-day flow trace retention: ~3-30GB
- 7-day trace event retention: ~350MB-3.5GB
- 90-day session retention: ~900MB-9GB
- **Total**: ~4.25-42.5GB

## Performance Impact

Longer retention periods:
- ✅ More historical data for analysis
- ✅ Better debugging capabilities
- ❌ Increased storage costs
- ❌ Slower query performance on large datasets

Shorter retention periods:
- ✅ Lower storage costs
- ✅ Better query performance
- ❌ Limited historical analysis
- ❌ Reduced debugging window

## Troubleshooting

### Retention Policy Not Applied

If retention policies aren't being applied:

1. Check if TimescaleDB extension is enabled:
```sql
SELECT extversion FROM pg_extension WHERE extname='timescaledb';
```

2. Verify hypertables exist:
```sql
SELECT * FROM timescaledb_information.hypertables;
```

3. Check for existing policies:
```sql
SELECT * FROM timescaledb_information.jobs WHERE proc_name = 'policy_retention';
```

4. Manually apply retention policy:
```sql
SELECT add_retention_policy('flow_traces', INTERVAL '30 days', if_not_exists => TRUE);
```

### Data Not Being Deleted

TimescaleDB runs retention policies as background jobs. To check job status:

```sql
SELECT * FROM timescaledb_information.job_stats 
WHERE job_id IN (
  SELECT job_id FROM timescaledb_information.jobs 
  WHERE proc_name = 'policy_retention'
);
```

To manually run retention job:
```sql
CALL run_job(
  (SELECT job_id FROM timescaledb_information.jobs 
   WHERE proc_name = 'policy_retention' 
   AND hypertable_name = 'flow_traces')
);
```

## Best Practices

1. **Set retention based on compliance requirements** - Ensure you meet any regulatory data retention requirements

2. **Monitor storage usage** - Regularly check disk usage and adjust retention as needed

3. **Test retention changes** - Always test retention policy changes in a non-production environment first

4. **Document your retention strategy** - Keep clear documentation of why specific retention periods were chosen

5. **Consider data archival** - For long-term storage needs, consider archiving old data to cheaper storage before deletion

6. **Use continuous aggregates** - Store aggregated data with longer retention for historical trends without keeping all raw data

## Related Documentation

- [TimescaleDB Migration Guide](./TIMESCALEDB_MIGRATION.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Production Deployment Guide](../deployments/README.md)