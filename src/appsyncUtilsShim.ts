/**
 * AppSync Utils Shim
 *
 * This module provides real implementations of the @aws-appsync/utils exports.
 * The official @aws-appsync/utils package only contains TypeScript types with
 * empty stubs - AWS AppSync runtime provides the actual implementations.
 *
 * For local development, this shim provides those implementations.
 *
 * Usage Options:
 *
 * 1. Use globals (recommended, matches AWS behavior):
 *    ```javascript
 *    // In your resolver - util, runtime, extensions are injected as globals
 *    export function request(ctx) {
 *      return { id: util.autoId() };
 *    }
 *    ```
 *
 * 2. Import from this package:
 *    ```javascript
 *    import { util, runtime, extensions } from 'appsync-local-server/utils';
 *    ```
 *
 * 3. Configure module aliasing (tsconfig.json or bundler):
 *    ```json
 *    {
 *      "compilerOptions": {
 *        "paths": {
 *          "@aws-appsync/utils": ["./node_modules/appsync-local-server/dist/appsyncUtilsShim.js"],
 *          "@aws-appsync/utils/dynamodb": ["./node_modules/appsync-local-server/dist/dynamodb.js"]
 *        }
 *      }
 *    }
 *    ```
 */

import { createContext } from './context.js';

// Create a default context to extract util, runtime, extensions
const defaultCtx = createContext({ arguments: {} });

/**
 * The util object contains general utility methods to help you work with data.
 * Reference: https://docs.aws.amazon.com/appsync/latest/devguide/resolver-util-reference-js.html
 */
export const util = defaultCtx.util;

/**
 * The runtime object provides information and control over the current execution.
 */
export const runtime = defaultCtx.runtime;

/**
 * The extensions object provides methods for subscription filtering and cache management.
 */
export const extensions = defaultCtx.extensions;

// Re-export types from @aws-appsync/utils for TypeScript compatibility
// These are the type definitions that users expect
export type {
  AppSyncIdentityCognito,
  AppSyncIdentityIAM,
  AppSyncIdentityLambda,
  AppSyncIdentityOIDC,
  Identity,
  Info,
  Request,
} from '@aws-appsync/utils';

// Export Context type
export type { ResolverContext as Context } from './types/index.js';
