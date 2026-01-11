import type { AppSyncRestrictions } from '../types/index.js';

/**
 * AppSync JavaScript restrictions and limitations based on official AWS documentation
 * Reference: https://docs.aws.amazon.com/appsync/latest/devguide/supported-features.html
 */
export const APPSYNC_RESTRICTIONS: AppSyncRestrictions = {
  // Actually disallowed globals (network/file system access and Node.js specific)
  disallowedGlobals: [
    // Network and HTTP related (explicitly not supported)
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'URL',
    'URLSearchParams',
    'FormData',
    'Headers',
    'Request',
    'Response',

    // Node.js specific globals
    'process',
    'Buffer',
    'global',
    'require',
    'module',
    'exports',
    '__dirname',
    '__filename',

    // Browser specific globals
    'window',
    'document',
    'navigator',
    'location',
    'history',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'openDatabase',
    'alert',
    'confirm',
    'prompt',

    // Advanced JavaScript features not supported
    'Map',
    'Set',
    'WeakMap',
    'WeakSet',
    'Proxy',
    'Reflect',
    'eval',
    'Function',

    // Timer functions
    'setTimeout',
    'setInterval',
    'clearTimeout',
    'clearInterval',
    'setImmediate',
    'clearImmediate',

    // Worker threads
    'Worker',
    'SharedWorker',

    // File system related
    'FileReader',
    'FileList',
    'Blob',

    // Crypto
    'crypto',
    'crypto.subtle',

    // Base64 (though some string methods might work)
    'atob',
    'btoa',
  ],

  // Disallowed operators (from AWS docs)
  disallowedOperators: [
    '\\+\\+',
    '\\-\\-',
    '~', // Unary operators not supported
    ' in ', // 'in' operator not supported
  ],

  // Disallowed statements (from AWS docs)
  disallowedStatements: [
    'catch',
    'try',
    'finally', // No try-catch blocks
    'throw', // No throw statements - use util.error() instead
    'continue',
    'do',
    'while', // No do-while, while, continue
    'for\\s*\\(', // Standard for loops not supported (for-in and for-of are OK)
  ],

  // Disallowed function features
  disallowedFunctionFeatures: [
    '\\.apply\\s*\\(',
    '\\.bind\\s*\\(',
    '\\.call\\s*\\(', // apply, bind, call not supported
    'new\\s+Function', // Function constructors not supported
  ],

  // Allowed globals (from AWS docs)
  allowedGlobals: [
    'console', // Console is supported for debugging
    'Object',
    'Array',
    'String',
    'Number',
    'Boolean',
    'Date',
    'Math',
    'JSON',
    'RegExp',
    'Error',
    'Infinity',
    'NaN',
    'undefined',
    'null',
    'isNaN',
    'isFinite',
    'parseInt',
    'parseFloat',
    'encodeURI',
    'decodeURI',
    'encodeURIComponent',
    'decodeURIComponent',
    'util',
    'extensions',
    'runtime', // AppSync specific globals
  ],

  // Disallowed methods on otherwise allowed objects
  disallowedMethods: {
    Math: ['random'], // Math.random() not supported
    Date: ['now'], // Date.now() not supported (use new Date().getTime() instead)
  },
};
