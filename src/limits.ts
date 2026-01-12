/**
 * AppSync Service Limits Enforcement
 *
 * This module implements AppSync service limits for local development.
 * These limits help catch issues before deployment.
 *
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/limits.html
 */

import * as fs from 'node:fs';

// AppSync Service Limits
export const LIMITS = {
  /** Maximum request timeout in milliseconds (30 seconds) */
  REQUEST_TIMEOUT_MS: 30_000,

  /** Maximum resolver code size in bytes (32KB) */
  RESOLVER_CODE_SIZE_BYTES: 32_768,

  /** Maximum response payload size in bytes (5MB) */
  RESPONSE_SIZE_BYTES: 5_242_880,

  /** Maximum subscription payload size in bytes (240KB) */
  SUBSCRIPTION_PAYLOAD_BYTES: 245_760,

  /** Maximum number of pipeline functions per resolver */
  MAX_PIPELINE_FUNCTIONS: 10,

  /** Maximum number of subscription invalidations per request */
  MAX_INVALIDATIONS_PER_REQUEST: 5,
} as const;

/**
 * Error class for AppSync limit violations
 */
export class AppSyncLimitError extends Error {
  public readonly limit: keyof typeof LIMITS;
  public readonly actual: number;
  public readonly maximum: number;

  constructor(limit: keyof typeof LIMITS, actual: number, maximum: number, message: string) {
    super(message);
    this.name = 'AppSyncLimitError';
    this.limit = limit;
    this.actual = actual;
    this.maximum = maximum;
  }
}

/**
 * Wraps a promise with a timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = LIMITS.REQUEST_TIMEOUT_MS,
  operationName = 'Request'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new AppSyncLimitError(
          'REQUEST_TIMEOUT_MS',
          timeoutMs,
          LIMITS.REQUEST_TIMEOUT_MS,
          `${operationName} exceeded the ${timeoutMs}ms timeout limit. AppSync enforces a 30-second timeout.`
        )
      );
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Checks the size of a response payload
 */
export function checkResponseSize(response: unknown, fieldName = 'response'): void {
  // Handle undefined/null responses (they serialize to 'null' in JSON)
  const json = JSON.stringify(response) ?? 'null';
  const sizeBytes = Buffer.byteLength(json, 'utf8');

  if (sizeBytes > LIMITS.RESPONSE_SIZE_BYTES) {
    const sizeMB = (sizeBytes / 1_048_576).toFixed(2);
    throw new AppSyncLimitError(
      'RESPONSE_SIZE_BYTES',
      sizeBytes,
      LIMITS.RESPONSE_SIZE_BYTES,
      `Response for '${fieldName}' is ${sizeMB}MB which exceeds the 5MB limit.`
    );
  }
}

/**
 * Checks the size of a subscription payload
 */
export function checkSubscriptionPayloadSize(payload: unknown, subscriptionField = 'subscription'): void {
  const json = JSON.stringify(payload);
  const sizeBytes = Buffer.byteLength(json, 'utf8');

  if (sizeBytes > LIMITS.SUBSCRIPTION_PAYLOAD_BYTES) {
    const sizeKB = (sizeBytes / 1024).toFixed(2);
    throw new AppSyncLimitError(
      'SUBSCRIPTION_PAYLOAD_BYTES',
      sizeBytes,
      LIMITS.SUBSCRIPTION_PAYLOAD_BYTES,
      `Subscription payload for '${subscriptionField}' is ${sizeKB}KB which exceeds the 240KB limit.`
    );
  }
}

/**
 * Checks the size of a resolver code file
 */
export function checkResolverCodeSize(filePath: string): void {
  try {
    const stats = fs.statSync(filePath);
    const sizeBytes = stats.size;

    if (sizeBytes > LIMITS.RESOLVER_CODE_SIZE_BYTES) {
      const sizeKB = (sizeBytes / 1024).toFixed(2);
      throw new AppSyncLimitError(
        'RESOLVER_CODE_SIZE_BYTES',
        sizeBytes,
        LIMITS.RESOLVER_CODE_SIZE_BYTES,
        `Resolver file '${filePath}' is ${sizeKB}KB which exceeds the 32KB limit.`
      );
    }
  } catch (error) {
    // If file doesn't exist or can't be read, let other parts handle it
    if (error instanceof AppSyncLimitError) {
      throw error;
    }
    // Ignore other errors (file not found, etc.)
  }
}

/**
 * Checks the number of pipeline functions
 */
export function checkPipelineFunctionCount(count: number, resolverField: string): void {
  if (count > LIMITS.MAX_PIPELINE_FUNCTIONS) {
    throw new AppSyncLimitError(
      'MAX_PIPELINE_FUNCTIONS',
      count,
      LIMITS.MAX_PIPELINE_FUNCTIONS,
      `Pipeline resolver '${resolverField}' has ${count} functions which exceeds the limit of 10.`
    );
  }
}

/**
 * Format bytes to a human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}
