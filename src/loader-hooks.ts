/**
 * ESM Loader Hooks for @aws-appsync/utils
 *
 * This module provides loader hooks that intercept imports from @aws-appsync/utils
 * and redirect them to our local implementations.
 *
 * When loaded via --import, this automatically registers the hooks.
 */

import { register } from 'node:module';

// Register the actual hooks module
// The second argument is the parent URL for resolving the hooks module
register('./loader-resolve.js', import.meta.url);
