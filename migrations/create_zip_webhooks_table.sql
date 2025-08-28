-- Migration: Create ZIP Webhooks Table
-- This table stores webhook configurations for the Zeal Integration Protocol (ZIP)
-- These are integration webhooks, different from workflow trigger webhooks

-- PostgreSQL version
CREATE TABLE IF NOT EXISTS zip_webhooks (
  id VARCHAR(255) PRIMARY KEY,
  namespace VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  events JSONB NOT NULL DEFAULT '["*"]'::jsonb,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_zip_webhooks_namespace ON zip_webhooks(namespace);
CREATE INDEX IF NOT EXISTS idx_zip_webhooks_active ON zip_webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_zip_webhooks_namespace_active ON zip_webhooks(namespace, is_active);
CREATE INDEX IF NOT EXISTS idx_zip_webhooks_events ON zip_webhooks USING gin(events);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_zip_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_zip_webhooks_updated_at
  BEFORE UPDATE ON zip_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_zip_webhooks_updated_at();

-- Comments for documentation
COMMENT ON TABLE zip_webhooks IS 'Stores webhook configurations for ZIP integrations';
COMMENT ON COLUMN zip_webhooks.id IS 'Unique identifier for the webhook';
COMMENT ON COLUMN zip_webhooks.namespace IS 'Namespace of the integration (e.g., reflow, n8n)';
COMMENT ON COLUMN zip_webhooks.url IS 'URL to send webhook events to';
COMMENT ON COLUMN zip_webhooks.events IS 'Array of event types to send, or ["*"] for all events';
COMMENT ON COLUMN zip_webhooks.headers IS 'Custom headers to include in webhook requests';
COMMENT ON COLUMN zip_webhooks.is_active IS 'Whether the webhook is currently active';
COMMENT ON COLUMN zip_webhooks.metadata IS 'Additional metadata for the webhook';