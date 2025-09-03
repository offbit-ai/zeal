# SDK Publishing Guide

This guide covers how to publish the various Zeal SDKs to their respective package registries.

## Prerequisites

### NPM (TypeScript SDKs)

1. **Create an NPM Access Token**:
   - Go to [NPM Token Settings](https://www.npmjs.com/settings/~your-username~/tokens)
   - Click "Generate New Token" → "Classic Token"
   - Select "Automation" type for CI/CD
   - Copy the generated token

2. **Configure Authentication** (choose one method):

   **Option A: Environment Variable**:
   ```bash
   export NPM_TOKEN=npm_xxxxxxxxxxxxxxxxxxxx
   # or
   export NPM_ACCESS_TOKEN=npm_xxxxxxxxxxxxxxxxxxxx
   ```

   **Option B: .env.npm File** (recommended for local development):
   ```bash
   # Copy the example file
   cp .env.npm.example .env.npm
   
   # Edit .env.npm and add your token
   NPM_TOKEN=npm_xxxxxxxxxxxxxxxxxxxx
   ```

   **Option C: Interactive Login**:
   ```bash
   npm login
   ```

3. **Authentication Priority**:
   - Environment variables (NPM_TOKEN/NPM_ACCESS_TOKEN)
   - .env.npm file (automatically loaded if present)
   - npm login session

### PyPI (Python SDK)

1. **Create a PyPI API Token**:
   - Go to [PyPI Account Settings](https://pypi.org/manage/account/)
   - Scroll to "API tokens" section
   - Click "Add API token"
   - Set scope to "Entire account" or specific to "zeal-sdk"
   - Copy the generated token

2. **Configure Authentication**:
   ```bash
   # Set environment variable
   export TWINE_PASSWORD=pypi-AgEIcHlwaS5vcmcCJDU...
   export TWINE_USERNAME=__token__
   ```

   Or create `~/.pypirc`:
   ```ini
   [pypi]
   username = __token__
   password = pypi-AgEIcHlwaS5vcmcCJDU...
   ```

### Go SDK

The Go SDK doesn't require authentication for publishing. It uses Git tags that are automatically indexed by pkg.go.dev.

### Rust SDK (crates.io)

1. **Create a crates.io API Token**:
   - Go to [crates.io Token Settings](https://crates.io/settings/tokens)
   - Click "New Token"
   - Give it a descriptive name (e.g., "zeal-sdk-publish")
   - Copy the generated token

2. **Configure Authentication** (choose one method):

   **Option A: Environment Variable**:
   ```bash
   export CARGO_REGISTRY_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   **Option B: .env.npm File** (recommended for local development):
   ```bash
   # Add to .env.npm
   CARGO_REGISTRY_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   **Option C: Cargo Login**:
   ```bash
   cargo login
   # Paste your token when prompted
   ```

## Publishing Individual SDKs

### TypeScript SDK (@offbit-ai/zeal-sdk)

```bash
cd packages/zeal-sdk
export NPM_TOKEN=your_npm_token_here
./scripts/publish.sh patch  # or minor, major
```

### Embed SDK (@offbit-ai/zeal-embed-sdk)

```bash
cd packages/zeal-embed-sdk
export NPM_TOKEN=your_npm_token_here
./scripts/publish.sh patch  # or minor, major
```

### Python SDK (zeal-sdk)

```bash
cd packages/zeal-python-sdk
./scripts/publish.sh patch  # or minor, major
```

### Go SDK

```bash
cd packages/zeal-go-sdk
./scripts/publish.sh patch  # or minor, major
```

### Rust SDK

```bash
cd packages/zeal-rust-sdk
export CARGO_REGISTRY_TOKEN=your_crates_io_token_here  # or use .env.npm
./scripts/publish.sh patch  # or minor, major
```

## Publishing Multiple SDKs

Use the root-level publish script:

```bash
# Set authentication tokens (or use .env.npm file)
export NPM_TOKEN=your_npm_token_here
export TWINE_PASSWORD=your_pypi_token_here
export TWINE_USERNAME=__token__
export CARGO_REGISTRY_TOKEN=your_crates_io_token_here

# Or create .env.npm with all tokens and it will be loaded automatically

# Run the publisher
./scripts/publish-sdks.sh patch

# Select which SDKs to publish:
# 1) TypeScript SDK only
# 2) Embed SDK only  
# 3) Python SDK only
# 4) Go SDK only
# 5) Rust SDK only
# 6) All TypeScript SDKs
# 7) All SDKs
```

## GitHub Actions CI/CD

### Setting up Secrets

1. Go to your GitHub repository settings
2. Navigate to "Secrets and variables" → "Actions"
3. Add the following repository secrets:
   - `NPM_TOKEN`: Your NPM access token
   - `PYPI_TOKEN`: Your PyPI API token
   - `CARGO_REGISTRY_TOKEN`: Your crates.io API token

### Manual Workflow Dispatch

1. Go to the "Actions" tab in your repository
2. Select "SDK Publish" workflow
3. Click "Run workflow"
4. Select:
   - SDK to publish (typescript/embed/python/go/rust/all)
   - Version bump type (patch/minor/major/prerelease)
   - Prerelease identifier (if using prerelease)

### Automated Release Publishing

Create a GitHub release with appropriate tags:
- `v1.2.3` - Publishes all SDKs with version 1.2.3
- `typescript-sdk-v1.2.3` - Publishes TypeScript SDK only
- `embed-sdk-v1.2.3` - Publishes Embed SDK only
- `python-sdk-v1.2.3` - Publishes Python SDK only
- `go-sdk-v1.2.3` - Publishes Go SDK only
- `rust-sdk-v1.2.3` - Publishes Rust SDK only

## Version Management

### Semantic Versioning

All SDKs follow semantic versioning:
- **patch**: Bug fixes and minor updates (1.0.0 → 1.0.1)
- **minor**: New features, backward compatible (1.0.0 → 1.1.0)
- **major**: Breaking changes (1.0.0 → 2.0.0)
- **prerelease**: Beta/alpha releases (1.0.0 → 1.0.1-beta.0)

### Version Synchronization

While SDKs can have independent versions, consider keeping them synchronized for major releases to maintain consistency across the ecosystem.

## Package Registry URLs

After publishing, the SDKs will be available at:

- **NPM**: 
  - https://www.npmjs.com/package/@offbit-ai/zeal-sdk
  - https://www.npmjs.com/package/@offbit-ai/zeal-embed-sdk
  
- **PyPI**: 
  - https://pypi.org/project/zeal-sdk/
  
- **Go**: 
  - https://pkg.go.dev/github.com/offbit-ai/zeal/packages/zeal-go-sdk
  
- **Rust**: 
  - https://crates.io/crates/zeal-sdk

## Troubleshooting

### NPM Publishing Issues

```bash
# Check authentication
npm whoami

# Clear npm cache
npm cache clean --force

# Verify package contents
npm pack --dry-run
```

### PyPI Publishing Issues

```bash
# Test on TestPyPI first
twine upload --repository testpypi dist/*

# Check package
twine check dist/*
```

### Go Module Issues

```bash
# Ensure module is valid
go mod tidy
go mod verify

# Force pkg.go.dev to update
curl https://proxy.golang.org/github.com/offbit-ai/zeal/packages/zeal-go-sdk/@v/list
```

### Rust/Crates.io Publishing Issues

```bash
# Check authentication
cargo login

# Verify package metadata
cargo package --list

# Test with dry run
cargo publish --dry-run

# Check for duplicate version
cargo search zeal-sdk
```

## Security Best Practices

1. **Never commit tokens to version control**
2. **Use environment variables for CI/CD**
3. **Rotate tokens regularly**
4. **Use scoped tokens when possible**
5. **Enable 2FA on package registry accounts**
6. **Review package contents before publishing**

## Pre-publish Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] Version bumped appropriately
- [ ] Breaking changes documented
- [ ] Examples updated and tested
- [ ] Authentication tokens configured
- [ ] Git repository is clean (no uncommitted changes)