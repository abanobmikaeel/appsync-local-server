/**
 * ESM Loader Resolve Hooks
 *
 * This module exports the actual resolve hook that intercepts @aws-appsync/utils
 * imports and redirects them to our local implementations.
 */

import { existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Get the directory where this loader is located
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Determine if we're running from dist/ (compiled) or src/ (development)
const isInDist = __dirname.includes('/dist/');

// Get the project root (go up from dist/src/ or src/)
const projectRoot = isInDist ? resolvePath(__dirname, '..', '..') : resolvePath(__dirname, '..');

// Get path to shim files - always prefer compiled .js from dist/ when available
// This is important because resolver imports happen at runtime with vanilla Node.js,
// not tsx, so we need compiled JavaScript files.
function getShimPath(baseName: string): string {
  // Always check dist/ first for compiled .js files
  const distJsPath = resolvePath(projectRoot, 'dist', 'src', `${baseName}.js`);
  if (existsSync(distJsPath)) {
    return distJsPath;
  }

  // Fall back to current directory's .js file (for compiled dist/ context)
  const localJsPath = resolvePath(__dirname, `${baseName}.js`);
  if (existsSync(localJsPath)) {
    return localJsPath;
  }

  // No compiled .js file found - this is an error condition
  // We cannot return .ts files because Node.js cannot load them directly
  throw new Error(
    `[appsync-local] Could not find compiled shim file: ${baseName}.js\n` +
      `Looked in:\n  - ${distJsPath}\n  - ${localJsPath}\n` +
      `Run 'npm run build' to compile TypeScript files.`
  );
}

// Map of @aws-appsync/utils paths to our implementations
const REDIRECTS: Record<string, string> = {
  '@aws-appsync/utils': getShimPath('appsyncUtilsShim'),
  '@aws-appsync/utils/dynamodb': getShimPath('dynamodb'),
};

interface ResolveContext {
  parentURL?: string;
  conditions?: string[];
}

interface ResolveResult {
  url: string;
  shortCircuit?: boolean;
  format?: string;
}

type NextResolve = (specifier: string, context: ResolveContext) => Promise<ResolveResult>;

/**
 * Resolve hook - intercepts module resolution and redirects @aws-appsync/utils
 */
export async function resolve(
  specifier: string,
  context: ResolveContext,
  nextResolve: NextResolve
): Promise<ResolveResult> {
  // Check if this is an @aws-appsync/utils import we should redirect
  const redirectPath = REDIRECTS[specifier];
  if (redirectPath) {
    return {
      url: pathToFileURL(redirectPath).href,
      shortCircuit: true,
    };
  }

  // For all other imports, use default resolution
  return nextResolve(specifier, context);
}
