#!/usr/bin/env node

/**
 * Build script for Rust CRDT server
 *
 * This script ensures the Rust server is built before starting the application.
 * It can be run during development or production builds.
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const RUST_SERVER_DIR = path.join(__dirname, '..', 'crdt-server')
const CARGO_TOML = path.join(RUST_SERVER_DIR, 'Cargo.toml')

function checkRustInstalled() {
  return new Promise(resolve => {
    const cargo = spawn('cargo', ['--version'], { stdio: 'pipe' })
    cargo.on('close', code => {
      resolve(code === 0)
    })
    cargo.on('error', () => {
      resolve(false)
    })
  })
}

function buildRustServer(mode = 'debug') {
  return new Promise((resolve, reject) => {
    // console.log removed...`);

    const args = mode === 'release' ? ['build', '--release'] : ['build']
    const cargo = spawn('cargo', args, {
      cwd: RUST_SERVER_DIR,
      stdio: 'inherit',
    })

    cargo.on('close', code => {
      if (code === 0) {
        // console.log removed`);
        resolve()
      } else {
        console.error(`❌ Rust CRDT server build failed with code ${code}`)
        reject(new Error(`Cargo build failed with code ${code}`))
      }
    })

    cargo.on('error', error => {
      console.error('❌ Failed to start cargo build:', error.message)
      reject(error)
    })
  })
}

async function main() {
  const args = process.argv.slice(2)
  const mode = args.includes('--release') ? 'release' : 'debug'
  const skipRustCheck = args.includes('--skip-rust-check')
  const skipRustBuild = args.includes('--skip-rust-build')

  // Skip Rust build if explicitly requested
  if (skipRustBuild) {
    // console.log removed');
    process.exit(0)
  }

  // Check if Rust server directory exists
  if (!fs.existsSync(CARGO_TOML)) {
    // console.log removed
    process.exit(0)
  }

  // Check if Rust is installed
  if (!skipRustCheck) {
    const rustInstalled = await checkRustInstalled()
    if (!rustInstalled) {
      console.error('❌ Rust/Cargo not found. Please install Rust: https://rustup.rs/')
      // console.log removed
      process.exit(1)
    }
  }

  try {
    await buildRustServer(mode)
    // console.log removed
  } catch (error) {
    console.error('💥 Build failed:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { buildRustServer, checkRustInstalled }
