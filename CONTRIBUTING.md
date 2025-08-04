# Contributing to Zeal

We love your input! We want to make contributing to Zeal as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Pull Request Process

1. Update the README.md with details of changes to the interface, if applicable.
2. Update the docs/ with any new features or changes.
3. The PR will be merged once you have the sign-off of at least one maintainer.

## Any contributions you make will be under the Apache License 2.0

In short, when you submit code changes, your submissions are understood to be under the same [Apache License 2.0](LICENSE) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using GitHub's [issue tracker](https://github.com/offbit-ai/zeal/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/offbit-ai/zeal/issues/new); it's that easy!

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Development Setup

### Prerequisites

- Node.js 20+
- Rust 1.75+ (for CRDT server)
- PostgreSQL 14+
- Redis 6+

### Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/offbit-ai/zeal.git
   cd zeal
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   cp .env.local.example .env.local
   ```

4. Set up the database:

   ```bash
   createdb zeal_db
   psql zeal_db < init.sql
   ```

5. Build the CRDT server:

   ```bash
   cd crdt-server
   cargo build
   cd ..
   ```

6. Start development servers:
   ```bash
   npm run dev
   ```

### Code Style

#### TypeScript/JavaScript

- We use ESLint and Prettier for code formatting
- Run `npm run lint` to check your code
- Run `npm run format` to auto-format

#### Rust

- Follow standard Rust conventions
- Run `cargo fmt` before committing
- Run `cargo clippy` to check for common mistakes

### Testing

#### Frontend Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# All tests
npm run test:all
```

#### Rust Tests

```bash
cd crdt-server
cargo test
```

### Project Structure

```
zeal/
├── app/              # Next.js app directory
├── components/       # React components
├── services/         # API services
├── store/           # State management
├── types/           # TypeScript types
├── utils/           # Utility functions
├── crdt-server/     # Rust CRDT server
└── docs/            # Documentation
```

## Code Review Process

The core team reviews Pull Requests on a regular basis. During code review, we look for:

- **Correctness**: Does the code do what it's supposed to?
- **Complexity**: Is the code more complex than it needs to be?
- **Consistency**: Does the code follow our conventions?
- **Coverage**: Is the code adequately tested?
- **Documentation**: Are complex parts documented?

## Community

- Discord [coming soon]
- Blog [coming soon]
- Newsletter [coming soon]

## License

By contributing, you agree that your contributions will be licensed under its Apache License 2.0.
