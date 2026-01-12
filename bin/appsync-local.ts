#!/usr/bin/env node

/**
 * AppSync Local CLI Entry Point
 *
 * This script ensures the ESM loader hooks are registered before running the CLI.
 * The loader intercepts @aws-appsync/utils imports and redirects them to our
 * local implementations, allowing developers to use standard AWS imports.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if we're already running with our loader (set by re-spawned process)
const LOADER_ACTIVE = process.env.__APPSYNC_LOCAL_LOADER_ACTIVE === '1';

// Check if running from compiled dist (vs tsx/ts-node which handles its own module resolution)
const isCompiledDist = __dirname.includes('dist');

if (!LOADER_ACTIVE && isCompiledDist) {
  // Only re-spawn when running compiled JS and loader hooks are needed
  // Loader is at dist/src/loader-hooks.js relative to dist/bin/
  const loaderPath = resolve(__dirname, '..', 'src', 'loader-hooks.js');

  if (existsSync(loaderPath)) {
    const child = spawn(process.execPath, ['--import', loaderPath, __filename, ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: {
        ...process.env,
        __APPSYNC_LOCAL_LOADER_ACTIVE: '1',
      },
    });

    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });
  } else {
    // Loader not found, run without it (fallback)
    console.warn('[appsync-local] Loader hooks not found, @aws-appsync/utils imports may not work');
    const { runCli } = await import('../src/cli.js');
    runCli();
  }
} else {
  // Running via tsx/ts-node OR loader is already active
  // For tsx mode, register the loader inline (no re-spawn needed)
  if (!LOADER_ACTIVE && !isCompiledDist) {
    // Register loader hooks for tsx development mode
    const loaderResolvePath = resolve(__dirname, '..', 'src', 'loader-resolve.ts');
    if (existsSync(loaderResolvePath)) {
      register(pathToFileURL(loaderResolvePath).href, import.meta.url);
    }
  }

  const { runCli } = await import('../src/cli.js');
  runCli();
}
