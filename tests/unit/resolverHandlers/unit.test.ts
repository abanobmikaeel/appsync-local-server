import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { EarlyReturnError } from '../../../src/context.js';
import type { DataSource, UnitResolver } from '../../../src/types/index.js';

describe('createUnitResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('integration tests with NONE data source', () => {
    // These tests use actual resolver files and the NONE data source
    // to validate the resolver handler behavior

    it('should load and execute a simple resolver', async () => {
      // We'll dynamically import to test the actual implementation
      const { createUnitResolver } = await import('../../../src/resolverHandlers/unit.js');

      const mockDataSources: DataSource[] = [{ type: 'NONE', name: 'TestDS' }];

      const mockResolver: UnitResolver = {
        type: 'Query',
        field: 'testField',
        kind: 'Unit',
        dataSource: 'TestDS',
        file: 'examples/basic/resolvers/echo.js',
      };

      const resolver = await createUnitResolver(mockResolver, mockDataSources);
      expect(typeof resolver).toBe('function');

      // Execute the resolver
      const mockContext = {
        headers: { 'x-api-key': 'test-key' },
      };
      const mockInfo = {
        fieldName: 'testField',
        parentType: { name: 'Query' },
        variableValues: {},
      };

      const result = await resolver(null, { message: 'hello' }, mockContext, mockInfo);
      expect(result).toBeDefined();
    });
  });
});

describe('Unit resolver context handling', () => {
  it('should provide all required context properties', async () => {
    const { createContext } = await import('../../../src/context.js');

    // Test that context has all required properties
    const ctx = createContext({
      arguments: { id: '123' },
      source: { parentId: 'parent-1' },
      identity: { sub: 'user-1', claims: {} },
      request: { headers: { 'content-type': 'application/json' } },
      info: { fieldName: 'test', parentTypeName: 'Query' },
    });

    // Check core properties
    expect(ctx.arguments).toEqual({ id: '123' });
    expect(ctx.source).toEqual({ parentId: 'parent-1' });
    expect(ctx.stash).toEqual({});
    expect(ctx.prev).toEqual({});

    // Check utilities
    expect(ctx.util).toBeDefined();
    expect(typeof ctx.util.autoId).toBe('function');
    expect(typeof ctx.util.time.nowISO8601).toBe('function');
    expect(typeof ctx.util.transform.toJson).toBe('function');

    // Check runtime
    expect(ctx.runtime).toBeDefined();
    expect(typeof ctx.runtime.earlyReturn).toBe('function');

    // Check extensions
    expect(ctx.extensions).toBeDefined();
    expect(typeof ctx.extensions.setSubscriptionFilter).toBe('function');
    expect(typeof ctx.extensions.setSubscriptionInvalidationFilter).toBe('function');
    expect(typeof ctx.extensions.invalidateSubscriptions).toBe('function');
    expect(typeof ctx.extensions.evictFromApiCache).toBe('function');
  });

  it('should extract identity from JWT headers', async () => {
    const { extractIdentityFromHeaders } = await import('../../../src/context.js');

    // Test JWT with standard structure
    const testJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsIm5hbWUiOiJUZXN0IFVzZXIiLCJpYXQiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    const identity = extractIdentityFromHeaders({
      Authorization: `Bearer ${testJwt}`,
    });

    expect(identity).toBeDefined();
    expect(identity?.sub).toBe('user-123');
  });

  it('should extract identity from API key headers', async () => {
    const { extractIdentityFromHeaders } = await import('../../../src/context.js');

    const identity = extractIdentityFromHeaders({
      'x-api-key': 'my-test-api-key',
    });

    expect(identity).toBeDefined();
    expect(identity?.sub).toBe('api-key-user');
    expect(identity?.claims?.authType).toBe('API_KEY');
  });
});

describe('EarlyReturn handling', () => {
  it('should throw EarlyReturnError when runtime.earlyReturn is called', async () => {
    const { createContext, isEarlyReturn } = await import('../../../src/context.js');

    const ctx = createContext({ arguments: {} });

    // Calling earlyReturn should throw
    try {
      ctx.runtime.earlyReturn({ cached: true });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(isEarlyReturn(error)).toBe(true);
      expect((error as EarlyReturnError).data).toEqual({ cached: true });
    }
  });

  it('should correctly identify EarlyReturnError', async () => {
    const { EarlyReturnError, isEarlyReturn } = await import('../../../src/context.js');

    const earlyReturnError = new EarlyReturnError({ test: 'data' });
    expect(isEarlyReturn(earlyReturnError)).toBe(true);

    const regularError = new Error('regular error');
    expect(isEarlyReturn(regularError)).toBe(false);

    expect(isEarlyReturn(null)).toBe(false);
    expect(isEarlyReturn(undefined)).toBe(false);
    expect(isEarlyReturn('string')).toBe(false);
    expect(isEarlyReturn({})).toBe(false);
  });

  it('should preserve data in EarlyReturnError', async () => {
    const { EarlyReturnError } = await import('../../../src/context.js');

    const complexData = {
      items: [{ id: '1' }, { id: '2' }],
      nextToken: 'abc123',
      metadata: { count: 2 },
    };

    const error = new EarlyReturnError(complexData);
    expect(error.data).toEqual(complexData);
    expect(error.isEarlyReturn).toBe(true);
    expect(error.name).toBe('EarlyReturnError');
  });
});

describe('Extensions state management', () => {
  it('should reset extensions state', async () => {
    const { createContext, resetExtensionsState, getExtensionsState } = await import('../../../src/context.js');

    const ctx = createContext({ arguments: {} });

    // Add some state
    ctx.extensions.setSubscriptionFilter({ postId: { eq: '123' } });

    // Check state was added
    let state = getExtensionsState();
    expect(state.subscriptionFilters.length).toBeGreaterThan(0);

    // Reset and verify
    resetExtensionsState();
    state = getExtensionsState();
    expect(state.subscriptionFilters).toEqual([]);
    expect(state.subscriptionInvalidationFilters).toEqual([]);
    expect(state.invalidations).toEqual([]);
    expect(state.cacheEvictions).toEqual([]);
  });

  it('should track subscription filters', async () => {
    const { createContext, resetExtensionsState, getExtensionsState } = await import('../../../src/context.js');

    resetExtensionsState();
    const ctx = createContext({ arguments: {} });

    ctx.extensions.setSubscriptionFilter({ postId: { eq: '123' } });
    ctx.extensions.setSubscriptionFilter({ userId: { eq: 'user-1' } });

    const state = getExtensionsState();
    expect(state.subscriptionFilters).toHaveLength(2);
  });

  it('should enforce invalidation limit', async () => {
    const { createContext, resetExtensionsState } = await import('../../../src/context.js');

    resetExtensionsState();
    const ctx = createContext({ arguments: {} });

    // Should allow up to 5 invalidations
    for (let i = 0; i < 5; i++) {
      ctx.extensions.invalidateSubscriptions({
        subscriptionField: `field${i}`,
        payload: { id: i },
      });
    }

    // 6th should throw
    expect(() => {
      ctx.extensions.invalidateSubscriptions({
        subscriptionField: 'field6',
        payload: { id: 6 },
      });
    }).toThrow('Cannot call invalidateSubscriptions more than 5 times per request');
  });

  it('should track cache evictions', async () => {
    const { createContext, resetExtensionsState, getExtensionsState } = await import('../../../src/context.js');

    resetExtensionsState();
    const ctx = createContext({ arguments: {} });

    ctx.extensions.evictFromApiCache('Post', 'getPost', { id: '123' });

    const state = getExtensionsState();
    expect(state.cacheEvictions).toHaveLength(1);
    expect(state.cacheEvictions[0]).toEqual({
      typeName: 'Post',
      fieldName: 'getPost',
      keys: { id: '123' },
    });
  });
});
