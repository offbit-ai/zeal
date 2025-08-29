#!/bin/bash
set -e

# This script is executed by TimescaleDB during container initialization
# It applies configurable retention policies based on environment variables

echo "Applying TimescaleDB retention policies..."

# Wait for TimescaleDB to be fully initialized
sleep 5

# Get environment variables with defaults
TIMESCALE_RETENTION_FLOW_TRACES="${TIMESCALE_RETENTION_FLOW_TRACES:-30 days}"
TIMESCALE_RETENTION_TRACE_EVENTS="${TIMESCALE_RETENTION_TRACE_EVENTS:-7 days}"
TIMESCALE_RETENTION_SESSIONS="${TIMESCALE_RETENTION_SESSIONS:-90 days}"

# Apply retention policies via psql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Wait for hypertables to be created
    DO \$\$
    DECLARE
        counter INTEGER := 0;
        max_attempts INTEGER := 30;
    BEGIN
        LOOP
            -- Check if hypertables exist
            IF EXISTS (SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'flow_traces') AND
               EXISTS (SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'flow_trace_events') AND
               EXISTS (SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'flow_trace_sessions') THEN
                EXIT; -- All hypertables exist, proceed
            END IF;
            
            -- Wait and retry
            PERFORM pg_sleep(1);
            counter := counter + 1;
            
            IF counter >= max_attempts THEN
                RAISE EXCEPTION 'Hypertables not found after % attempts', max_attempts;
            END IF;
        END LOOP;
    END\$\$;
    
    -- Remove existing retention policies if they exist
    SELECT remove_retention_policy('flow_traces', if_exists => TRUE);
    SELECT remove_retention_policy('flow_trace_events', if_exists => TRUE);
    SELECT remove_retention_policy('flow_trace_sessions', if_exists => TRUE);
    
    -- Apply new retention policies with configured values
    SELECT add_retention_policy('flow_traces', 
        INTERVAL '${TIMESCALE_RETENTION_FLOW_TRACES}',
        if_not_exists => TRUE
    );
    
    SELECT add_retention_policy('flow_trace_events',
        INTERVAL '${TIMESCALE_RETENTION_TRACE_EVENTS}',
        if_not_exists => TRUE
    );
    
    SELECT add_retention_policy('flow_trace_sessions',
        INTERVAL '${TIMESCALE_RETENTION_SESSIONS}',
        if_not_exists => TRUE
    );
    
    -- Display configured retention policies
    SELECT 
        'Retention policies configured:' as message
    UNION ALL
    SELECT 
        '  flow_traces: ${TIMESCALE_RETENTION_FLOW_TRACES}'
    UNION ALL
    SELECT 
        '  flow_trace_events: ${TIMESCALE_RETENTION_TRACE_EVENTS}'
    UNION ALL
    SELECT 
        '  flow_trace_sessions: ${TIMESCALE_RETENTION_SESSIONS}';
EOSQL

echo "TimescaleDB retention policies applied successfully"