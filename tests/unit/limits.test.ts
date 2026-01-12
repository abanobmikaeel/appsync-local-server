import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import {
  AppSyncLimitError,
  checkPipelineFunctionCount,
  checkResolverCodeSize,
  checkResponseSize,
  checkSubscriptionPayloadSize,
  formatBytes,
  LIMITS,
  withTimeout,
} from '../../src/limits.js';

describe('LIMITS constants', () => {
  it('should have correct limit values', () => {
    expect(LIMITS.REQUEST_TIMEOUT_MS).toBe(30_000);
    expect(LIMITS.RESOLVER_CODE_SIZE_BYTES).toBe(32_768);
    expect(LIMITS.RESPONSE_SIZE_BYTES).toBe(5_242_880);
    expect(LIMITS.SUBSCRIPTION_PAYLOAD_BYTES).toBe(245_760);
    expect(LIMITS.MAX_PIPELINE_FUNCTIONS).toBe(10);
    expect(LIMITS.MAX_INVALIDATIONS_PER_REQUEST).toBe(5);
  });
});

describe('AppSyncLimitError', () => {
  it('should create error with correct properties', () => {
    const error = new AppSyncLimitError('REQUEST_TIMEOUT_MS', 35000, 30000, 'Request exceeded timeout');

    expect(error.name).toBe('AppSyncLimitError');
    expect(error.message).toBe('Request exceeded timeout');
    expect(error.limit).toBe('REQUEST_TIMEOUT_MS');
    expect(error.actual).toBe(35000);
    expect(error.maximum).toBe(30000);
  });
});

describe('withTimeout', () => {
  it('should resolve if promise completes within timeout', async () => {
    const result = await withTimeout(Promise.resolve('success'), 1000, 'Test operation');
    expect(result).toBe('success');
  });

  it('should reject with AppSyncLimitError on timeout', async () => {
    const slowPromise = new Promise((resolve) => setTimeout(() => resolve('done'), 5000));

    await expect(withTimeout(slowPromise, 50, 'Test operation')).rejects.toThrow(AppSyncLimitError);
  });

  it('should preserve original error if promise rejects', async () => {
    const failingPromise = Promise.reject(new Error('Original error'));

    await expect(withTimeout(failingPromise, 1000, 'Test')).rejects.toThrow('Original error');
  });

  it('should clear timeout when promise resolves', async () => {
    const result = await withTimeout(Promise.resolve({ data: 'test' }), 1000, 'Quick operation');
    expect(result).toEqual({ data: 'test' });
  });
});

describe('checkResponseSize', () => {
  it('should pass for small responses', () => {
    expect(() => checkResponseSize({ id: '1', name: 'test' })).not.toThrow();
  });

  it('should pass for null responses', () => {
    expect(() => checkResponseSize(null)).not.toThrow();
  });

  it('should pass for undefined responses', () => {
    expect(() => checkResponseSize(undefined)).not.toThrow();
  });

  it('should pass for arrays', () => {
    const arr = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    expect(() => checkResponseSize(arr)).not.toThrow();
  });

  it('should throw for responses exceeding 5MB', () => {
    // Create a large string (>5MB)
    const largeData = 'x'.repeat(6 * 1024 * 1024);

    expect(() => checkResponseSize(largeData, 'Query.getLargeData')).toThrow(AppSyncLimitError);
  });

  it('should include field name in error message', () => {
    const largeData = 'x'.repeat(6 * 1024 * 1024);

    try {
      checkResponseSize(largeData, 'Query.myField');
    } catch (error) {
      expect((error as Error).message).toContain('Query.myField');
      expect((error as Error).message).toContain('5MB');
    }
  });
});

describe('checkSubscriptionPayloadSize', () => {
  it('should pass for small payloads', () => {
    expect(() => checkSubscriptionPayloadSize({ id: '1', event: 'created' })).not.toThrow();
  });

  it('should throw for payloads exceeding 240KB', () => {
    const largePayload = 'x'.repeat(250 * 1024);

    expect(() => checkSubscriptionPayloadSize(largePayload, 'onPostCreated')).toThrow(AppSyncLimitError);
  });

  it('should include subscription field in error message', () => {
    const largePayload = 'x'.repeat(250 * 1024);

    try {
      checkSubscriptionPayloadSize(largePayload, 'onUserUpdated');
    } catch (error) {
      expect((error as Error).message).toContain('onUserUpdated');
      expect((error as Error).message).toContain('240KB');
    }
  });
});

describe('checkResolverCodeSize', () => {
  const tmpDir = os.tmpdir();

  it('should pass for small files', () => {
    const smallFile = path.join(tmpDir, 'small-resolver-test.js');
    fs.writeFileSync(smallFile, 'export function request() { return {}; }');

    expect(() => checkResolverCodeSize(smallFile)).not.toThrow();

    fs.unlinkSync(smallFile);
  });

  it('should throw for files exceeding 32KB', () => {
    const largeFile = path.join(tmpDir, 'large-resolver-test.js');
    const largeContent = 'x'.repeat(40 * 1024); // 40KB
    fs.writeFileSync(largeFile, largeContent);

    expect(() => checkResolverCodeSize(largeFile)).toThrow(AppSyncLimitError);

    fs.unlinkSync(largeFile);
  });

  it('should not throw for non-existent files', () => {
    // Non-existent files are handled by other parts of the system
    expect(() => checkResolverCodeSize('/non/existent/file.js')).not.toThrow();
  });

  it('should include file path in error message', () => {
    const largeFile = path.join(tmpDir, 'large-test-resolver.js');
    const largeContent = 'x'.repeat(40 * 1024);
    fs.writeFileSync(largeFile, largeContent);

    try {
      checkResolverCodeSize(largeFile);
    } catch (error) {
      expect((error as Error).message).toContain('large-test-resolver.js');
      expect((error as Error).message).toContain('32KB');
    }

    fs.unlinkSync(largeFile);
  });
});

describe('checkPipelineFunctionCount', () => {
  it('should pass for 10 or fewer functions', () => {
    expect(() => checkPipelineFunctionCount(0, 'Query.test')).not.toThrow();
    expect(() => checkPipelineFunctionCount(5, 'Query.test')).not.toThrow();
    expect(() => checkPipelineFunctionCount(10, 'Query.test')).not.toThrow();
  });

  it('should throw for more than 10 functions', () => {
    expect(() => checkPipelineFunctionCount(11, 'Query.test')).toThrow(AppSyncLimitError);
    expect(() => checkPipelineFunctionCount(15, 'Query.test')).toThrow(AppSyncLimitError);
  });

  it('should include resolver field in error message', () => {
    try {
      checkPipelineFunctionCount(12, 'Mutation.createOrder');
    } catch (error) {
      expect((error as Error).message).toContain('Mutation.createOrder');
      expect((error as Error).message).toContain('12');
      expect((error as Error).message).toContain('10');
    }
  });
});

describe('formatBytes', () => {
  it('should format bytes correctly', () => {
    expect(formatBytes(500)).toBe('500 bytes');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(2048)).toBe('2.00 KB');
    expect(formatBytes(1048576)).toBe('1.00 MB');
    expect(formatBytes(5242880)).toBe('5.00 MB');
  });

  it('should handle edge cases', () => {
    expect(formatBytes(0)).toBe('0 bytes');
    expect(formatBytes(1023)).toBe('1023 bytes');
    expect(formatBytes(1024 * 1024 - 1)).toBe('1024.00 KB');
  });
});
