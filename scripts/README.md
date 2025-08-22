# Build Scripts

This directory contains build and maintenance scripts for the Zeal project.

## Scripts

### `ingest-templates.js`

Ingests node templates into the database at build time.

**Usage:**

```bash
# Ingest templates (skips if already ingested)
npm run templates:ingest

# Force re-ingestion of all templates
npm run templates:ingest:force
```

**When to run:**

- Automatically runs during `npm install` (postinstall hook)
- Automatically runs during `npm run build`
- Manually when you add/modify node templates
- With `--force` flag when you need to refresh all templates

### `build-rust-server.js`

Builds the CRDT Rust server.

**Usage:**

```bash
# Development build
npm run crdt:check

# Release build
npm run crdt:build
```
