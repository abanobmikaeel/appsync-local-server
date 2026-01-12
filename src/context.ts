import { randomUUID } from 'crypto';
import type {
  AppSyncExtensions,
  AppSyncIdentity,
  AppSyncRuntime,
  AppSyncUtils,
  ResolverContext,
  SubscriptionFilter,
  SubscriptionInvalidationConfig,
} from './types/index.js';

// ============================================================================
// Early Return Error (used by runtime.earlyReturn())
// ============================================================================

/**
 * Special error thrown by runtime.earlyReturn() to exit pipeline early.
 * Caught by pipeline resolver handler to return data immediately.
 */
export class EarlyReturnError extends Error {
  public readonly data: unknown;
  public readonly isEarlyReturn = true;

  constructor(data?: unknown) {
    super('EarlyReturn');
    this.name = 'EarlyReturnError';
    this.data = data;
  }
}

/**
 * Check if an error is an EarlyReturnError
 */
export function isEarlyReturn(error: unknown): error is EarlyReturnError {
  if (error instanceof EarlyReturnError) return true;
  if (error instanceof Error && (error as EarlyReturnError).isEarlyReturn === true) return true;
  return false;
}

// ============================================================================
// Extensions State (per-request)
// ============================================================================

interface ExtensionsState {
  subscriptionFilters: Array<SubscriptionFilter | SubscriptionFilter[]>;
  subscriptionInvalidationFilters: Array<SubscriptionFilter | SubscriptionFilter[]>;
  invalidations: SubscriptionInvalidationConfig[];
  cacheEvictions: Array<{ typeName: string; fieldName: string; keys: Record<string, unknown> }>;
}

let currentExtensionsState: ExtensionsState = {
  subscriptionFilters: [],
  subscriptionInvalidationFilters: [],
  invalidations: [],
  cacheEvictions: [],
};

/**
 * Reset extensions state (call at start of each request)
 */
export function resetExtensionsState(): void {
  currentExtensionsState = {
    subscriptionFilters: [],
    subscriptionInvalidationFilters: [],
    invalidations: [],
    cacheEvictions: [],
  };
}

/**
 * Get current extensions state (for processing after resolver execution)
 */
export function getExtensionsState(): ExtensionsState {
  return { ...currentExtensionsState };
}

/**
 * Decode a JWT token without verification (for local development only)
 *
 * SECURITY WARNING: This function does NOT verify JWT signatures.
 * It is designed for local development where AWS AppSync would normally
 * handle JWT verification. DO NOT use this in production environments.
 *
 * In production AppSync, AWS validates:
 * - Token signature against the issuer's public key
 * - Token expiration (exp claim)
 * - Token audience (aud claim)
 * - Token issuer (iss claim)
 */
export function decodeJwt(token: string): AppSyncIdentity | null {
  try {
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

    // JWT has 3 parts: header.payload.signature
    const parts = cleanToken.split('.');
    if (parts.length !== 3) return null;

    // Decode the payload (base64url)
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    const claims = JSON.parse(decoded);

    return {
      sub: claims.sub,
      issuer: claims.iss,
      username: claims.username || claims['cognito:username'] || claims.email || claims.sub,
      claims,
      sourceIp: [],
      defaultAuthStrategy: 'ALLOW',
    };
  } catch {
    return null;
  }
}

/**
 * Extract identity from request headers
 * Supports: Authorization (JWT), x-api-key
 */
export function extractIdentityFromHeaders(headers: Record<string, string>): AppSyncIdentity | undefined {
  // Normalize header keys to lowercase
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

  // Try JWT from Authorization header
  const authHeader = normalizedHeaders.authorization;
  if (authHeader) {
    const identity = decodeJwt(authHeader);
    if (identity) return identity;
  }

  // API Key auth - no identity claims, just mark as authenticated
  const apiKey = normalizedHeaders['x-api-key'];
  if (apiKey) {
    return {
      sub: 'api-key-user',
      username: 'api-key-user',
      claims: { authType: 'API_KEY' },
      defaultAuthStrategy: 'ALLOW',
    };
  }

  return undefined;
}

// Response headers storage (per-request)
let responseHeaders: Record<string, string> = {};

// ============================================================================
// Runtime Module
// ============================================================================

/**
 * Create the runtime object with earlyReturn support
 */
function createRuntime(): AppSyncRuntime {
  return {
    earlyReturn: (data?: unknown): never => {
      throw new EarlyReturnError(data);
    },
  };
}

// ============================================================================
// Extensions Module
// ============================================================================

const MAX_INVALIDATIONS = 5;

/**
 * Create the extensions object for subscriptions and caching
 */
function createExtensions(): AppSyncExtensions {
  return {
    setSubscriptionFilter: (filter: SubscriptionFilter | SubscriptionFilter[]): void => {
      currentExtensionsState.subscriptionFilters.push(filter);
      // In local dev, log for visibility
      console.log('[extensions] setSubscriptionFilter:', JSON.stringify(filter));
    },

    setSubscriptionInvalidationFilter: (filter: SubscriptionFilter | SubscriptionFilter[]): void => {
      currentExtensionsState.subscriptionInvalidationFilters.push(filter);
      console.log('[extensions] setSubscriptionInvalidationFilter:', JSON.stringify(filter));
    },

    invalidateSubscriptions: (config: SubscriptionInvalidationConfig): void => {
      if (currentExtensionsState.invalidations.length >= MAX_INVALIDATIONS) {
        throw new Error(`Cannot call invalidateSubscriptions more than ${MAX_INVALIDATIONS} times per request`);
      }
      currentExtensionsState.invalidations.push(config);
      console.log('[extensions] invalidateSubscriptions:', JSON.stringify(config));
    },

    evictFromApiCache: (typeName: string, fieldName: string, keys: Record<string, unknown>): void => {
      currentExtensionsState.cacheEvictions.push({ typeName, fieldName, keys });
      console.log('[extensions] evictFromApiCache:', typeName, fieldName, JSON.stringify(keys));
    },
  };
}

/**
 * Create comprehensive AppSync util object
 * This provides all utility functions available in AppSync JavaScript resolvers
 * Reference: https://docs.aws.amazon.com/appsync/latest/devguide/resolver-util-reference-js.html
 */
function createUtil(): AppSyncUtils {
  const errors: Array<{ message: string; type?: string }> = [];
  responseHeaders = {};

  // Helper to convert JS values to DynamoDB format
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: type conversion requires multiple branches
  const toDynamoValue = (value: unknown): unknown => {
    if (value === null || value === undefined) {
      return { NULL: true };
    }
    if (typeof value === 'string') {
      return { S: value };
    }
    if (typeof value === 'number') {
      return { N: value.toString() };
    }
    if (typeof value === 'boolean') {
      return { BOOL: value };
    }
    if (Array.isArray(value)) {
      return { L: value.map(toDynamoValue) };
    }
    if (typeof value === 'object') {
      const mapped: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        mapped[k] = toDynamoValue(v);
      }
      return { M: mapped };
    }
    return value;
  };

  // Simple XML parser (basic implementation)
  const parseXml = (xml: string): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    const tagRegex = /<(\w+)(?:\s[^>]*)?>([^<]*)<\/\1>/g;
    let match = tagRegex.exec(xml);
    while (match !== null) {
      result[match[1]] = match[2];
      match = tagRegex.exec(xml);
    }
    return result;
  };

  return {
    // Error handling
    appendError: (message: string, errorType?: string, _data?: unknown, _errorInfo?: Record<string, unknown>) => {
      errors.push({ message, type: errorType });
    },
    error: (message: string, errorType?: string, _data?: unknown, _errorInfo?: Record<string, unknown>): never => {
      const error = new Error(message) as Error & { type?: string };
      error.type = errorType;
      throw error;
    },
    unauthorized: (): never => {
      const error = new Error('Unauthorized') as Error & { type?: string };
      error.type = 'Unauthorized';
      throw error;
    },

    // ID generation
    autoId: () => randomUUID(),
    autoUlid: () => {
      // ULID-like generator: timestamp + random
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 12).toUpperCase();
      return `${timestamp}${random}`.substring(0, 26).padEnd(26, '0');
    },
    autoKsuid: () => {
      // KSUID-like generator: timestamp + random
      const timestamp = Math.floor(Date.now() / 1000).toString(36);
      const random = Math.random().toString(36).substring(2, 15);
      return `${timestamp}${random}`.substring(0, 27);
    },

    // Encoding utilities
    base64Encode: (data: string) => Buffer.from(data, 'utf-8').toString('base64'),
    base64Decode: (data: string) => Buffer.from(data, 'base64').toString('utf-8'),
    urlEncode: (data: string) => encodeURIComponent(data),
    urlDecode: (data: string) => decodeURIComponent(data),

    // Pattern matching (Java regex compatible)
    matches: (pattern: string, data: string) => new RegExp(pattern).test(data),

    // JavaScript escaping
    escapeJavaScript: (data: string) =>
      data
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t'),

    // Auth type (returns placeholder - actual implementation depends on request context)
    authType: () => 'API Key Authorization',

    // Null/empty checks
    isNull: (value: unknown) => value === null || value === undefined,
    isNullOrEmpty: (value: unknown) =>
      value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0),
    isNullOrBlank: (value: unknown) =>
      value === null || value === undefined || (typeof value === 'string' && value.trim() === ''),
    defaultIfNull: <T>(value: T | null | undefined, defaultValue: T): T =>
      value === null || value === undefined ? defaultValue : value,
    defaultIfNullOrEmpty: <T>(value: T | null | undefined, defaultValue: T): T => {
      if (value === null || value === undefined || value === '') return defaultValue;
      if (Array.isArray(value) && value.length === 0) return defaultValue;
      return value;
    },
    defaultIfNullOrBlank: <T>(value: T | null | undefined, defaultValue: T): T => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string' && value.trim() === '') return defaultValue;
      return value;
    },

    // Type checking
    typeOf: (value: unknown) => {
      if (value === null) return 'Null';
      if (Array.isArray(value)) return 'List';
      const type = typeof value;
      if (type === 'object') return 'Map';
      return type.charAt(0).toUpperCase() + type.slice(1);
    },

    time: {
      nowISO8601: () => new Date().toISOString(),
      nowEpochSeconds: () => Math.floor(Date.now() / 1000),
      nowEpochMilliSeconds: () => Date.now(),
      nowFormatted: (format: string, _timezone?: string) => {
        const now = new Date();
        return format
          .replace('yyyy', now.getFullYear().toString())
          .replace('MM', (now.getMonth() + 1).toString().padStart(2, '0'))
          .replace('dd', now.getDate().toString().padStart(2, '0'))
          .replace('HH', now.getHours().toString().padStart(2, '0'))
          .replace('mm', now.getMinutes().toString().padStart(2, '0'))
          .replace('ss', now.getSeconds().toString().padStart(2, '0'));
      },
      parseISO8601ToEpochMilliSeconds: (date: string) => new Date(date).getTime(),
      parseFormattedToEpochMilliSeconds: (date: string, _format: string, _timezone?: string) =>
        new Date(date).getTime(),
      epochMilliSecondsToSeconds: (epoch: number) => Math.floor(epoch / 1000),
      epochMilliSecondsToISO8601: (epoch: number) => new Date(epoch).toISOString(),
      epochMilliSecondsToFormatted: (epoch: number, format: string, _timezone?: string) => {
        const date = new Date(epoch);
        return format
          .replace('yyyy', date.getFullYear().toString())
          .replace('MM', (date.getMonth() + 1).toString().padStart(2, '0'))
          .replace('dd', date.getDate().toString().padStart(2, '0'))
          .replace('HH', date.getHours().toString().padStart(2, '0'))
          .replace('mm', date.getMinutes().toString().padStart(2, '0'))
          .replace('ss', date.getSeconds().toString().padStart(2, '0'));
      },
    },

    dynamodb: {
      toDynamoDB: toDynamoValue,
      toMapValues: (value: Record<string, unknown>) => {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
          result[k] = toDynamoValue(v);
        }
        return result;
      },
      toS3Object: (key: string, bucket: string, region: string, version?: string) => ({
        key,
        bucket,
        region,
        version,
      }),
      fromS3ObjectJson: (s3String: string) => {
        const parsed = JSON.parse(s3String);
        return parsed.s3 || parsed;
      },
      // Type-specific DynamoDB conversions
      toString: (value: string) => ({ S: value }),
      toStringSet: (values: string[]) => ({ SS: values }),
      toNumber: (value: number) => ({ N: value.toString() }),
      toNumberSet: (values: number[]) => ({ NS: values.map((n) => n.toString()) }),
      toBinary: (value: string) => ({ B: value }),
      toBinarySet: (values: string[]) => ({ BS: values }),
      toBoolean: (value: boolean) => ({ BOOL: value }),
      toNull: () => ({ NULL: true as const }),
      toList: (values: unknown[]) => ({ L: values.map(toDynamoValue) }),
      toMap: (value: Record<string, unknown>) => {
        const mapped: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
          mapped[k] = toDynamoValue(v);
        }
        return { M: mapped };
      },
    },

    str: {
      toUpper: (str: string) => str.toUpperCase(),
      toLower: (str: string) => str.toLowerCase(),
      toReplace: (str: string, substr: string, replacement: string) => str.replace(substr, replacement),
      normalize: (str: string, form: string) => str.normalize(form as 'NFC' | 'NFD' | 'NFKC' | 'NFKD'),
    },

    math: {
      roundNum: (num: number, precision = 0) => {
        const factor = 10 ** precision;
        return Math.round(num * factor) / factor;
      },
      minVal: (nums: number[]) => Math.min(...nums),
      maxVal: (nums: number[]) => Math.max(...nums),
      randomDouble: () => Math.random(),
      randomWithinRange: (min: number, max: number) => Math.random() * (max - min) + min,
    },

    transform: {
      toJson: (value: unknown) => JSON.stringify(value),
      toJsonPretty: (value: unknown) => JSON.stringify(value, null, 2),

      // Convert simple filter object to AppSync subscription filter format
      toSubscriptionFilter: (filter: Record<string, unknown>) => {
        const result: Record<string, Record<string, unknown>> = {};
        for (const [key, value] of Object.entries(filter)) {
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Already in filter format like { eq: "value" }
            result[key] = value as Record<string, unknown>;
          } else {
            // Simple value, convert to { eq: value }
            result[key] = { eq: value };
          }
        }
        return result;
      },

      // Convert filter to DynamoDB filter expression
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: DynamoDB filter expression logic requires multiple condition branches
      toDynamoDBFilterExpression: (filter: Record<string, unknown>) => {
        const expressions: string[] = [];
        const expressionNames: Record<string, string> = {};
        const expressionValues: Record<string, unknown> = {};
        let valueIndex = 0;

        for (const [field, condition] of Object.entries(filter)) {
          const nameKey = `#f${Object.keys(expressionNames).length}`;
          expressionNames[nameKey] = field;

          if (typeof condition === 'object' && condition !== null) {
            for (const [op, val] of Object.entries(condition as Record<string, unknown>)) {
              const valueKey = `:v${valueIndex++}`;
              expressionValues[valueKey] = val;

              switch (op) {
                case 'eq':
                  expressions.push(`${nameKey} = ${valueKey}`);
                  break;
                case 'ne':
                  expressions.push(`${nameKey} <> ${valueKey}`);
                  break;
                case 'lt':
                  expressions.push(`${nameKey} < ${valueKey}`);
                  break;
                case 'le':
                  expressions.push(`${nameKey} <= ${valueKey}`);
                  break;
                case 'gt':
                  expressions.push(`${nameKey} > ${valueKey}`);
                  break;
                case 'ge':
                  expressions.push(`${nameKey} >= ${valueKey}`);
                  break;
                case 'contains':
                  expressions.push(`contains(${nameKey}, ${valueKey})`);
                  break;
                case 'beginsWith':
                  expressions.push(`begins_with(${nameKey}, ${valueKey})`);
                  break;
                case 'between':
                  if (Array.isArray(val) && val.length === 2) {
                    const valueKey2 = `:v${valueIndex++}`;
                    expressionValues[valueKey] = val[0];
                    expressionValues[valueKey2] = val[1];
                    expressions.push(`${nameKey} BETWEEN ${valueKey} AND ${valueKey2}`);
                  }
                  break;
              }
            }
          } else {
            // Simple equality
            const valueKey = `:v${valueIndex++}`;
            expressionValues[valueKey] = condition;
            expressions.push(`${nameKey} = ${valueKey}`);
          }
        }

        return {
          expression: expressions.join(' AND '),
          expressionNames,
          expressionValues,
        };
      },

      // Alias for condition expressions (same logic)
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: DynamoDB condition expression logic requires multiple condition branches
      toDynamoDBConditionExpression: (condition: Record<string, unknown>) => {
        // Reuse filter expression logic
        const expressions: string[] = [];
        const expressionNames: Record<string, string> = {};
        const expressionValues: Record<string, unknown> = {};
        let valueIndex = 0;

        for (const [field, cond] of Object.entries(condition)) {
          const nameKey = `#c${Object.keys(expressionNames).length}`;
          expressionNames[nameKey] = field;

          if (typeof cond === 'object' && cond !== null) {
            for (const [op, val] of Object.entries(cond as Record<string, unknown>)) {
              const valueKey = `:v${valueIndex++}`;
              expressionValues[valueKey] = val;

              switch (op) {
                case 'eq':
                  expressions.push(`${nameKey} = ${valueKey}`);
                  break;
                case 'ne':
                  expressions.push(`${nameKey} <> ${valueKey}`);
                  break;
                case 'attributeExists':
                  expressions.push(val ? `attribute_exists(${nameKey})` : `attribute_not_exists(${nameKey})`);
                  break;
                default:
                  expressions.push(`${nameKey} = ${valueKey}`);
              }
            }
          } else {
            const valueKey = `:v${valueIndex++}`;
            expressionValues[valueKey] = cond;
            expressions.push(`${nameKey} = ${valueKey}`);
          }
        }

        return {
          expression: expressions.join(' AND '),
          expressionNames,
          expressionValues,
        };
      },
    },

    http: {
      copyHeaders: (headers: Record<string, string>) => ({ ...headers }),
      addResponseHeader: (key: string, value: string) => {
        responseHeaders[key] = value;
      },
      addResponseHeaders: (headers: Record<string, string>) => {
        Object.assign(responseHeaders, headers);
      },
    },

    xml: {
      toMap: parseXml,
      toJsonString: (xml: string) => JSON.stringify(parseXml(xml)),
    },
  };
}

/** Options for creating resolver context */
export interface CreateContextOptions<TArgs = Record<string, unknown>> {
  arguments: TArgs;
  source?: unknown;
  identity?: {
    sub?: string;
    issuer?: string;
    username?: string;
    claims?: Record<string, unknown>;
    sourceIp?: string[];
    defaultAuthStrategy?: string;
  };
  request?: {
    headers: Record<string, string>;
    domainName?: string;
  };
  info?: {
    fieldName: string;
    parentTypeName: string;
    variables?: Record<string, unknown>;
    selectionSetList?: string[];
    selectionSetGraphQL?: string;
  };
  stash?: Record<string, unknown>;
  prev?: { result?: unknown };
}

/** Create resolver context with full AppSync-compatible fields */
export function createContext<TArgs = Record<string, unknown>>(
  options: TArgs | CreateContextOptions<TArgs>
): ResolverContext<TArgs> {
  // Support both simple args and full options object
  const isFullOptions = (opt: unknown): opt is CreateContextOptions<TArgs> =>
    typeof opt === 'object' && opt !== null && 'arguments' in opt;

  if (isFullOptions(options)) {
    return {
      arguments: options.arguments,
      source: options.source,
      identity: options.identity,
      request: options.request,
      info: options.info,
      stash: options.stash ?? {},
      prev: options.prev ?? {},
      util: createUtil(),
      runtime: createRuntime(),
      extensions: createExtensions(),
      env: process.env as Record<string, string | undefined>,
    };
  }

  // Legacy: simple args object
  return {
    arguments: options,
    stash: {},
    prev: {},
    util: createUtil(),
    runtime: createRuntime(),
    extensions: createExtensions(),
    env: process.env as Record<string, string | undefined>,
  };
}

/** Get current response headers (for HTTP responses) */
export function getResponseHeaders(): Record<string, string> {
  return { ...responseHeaders };
}
