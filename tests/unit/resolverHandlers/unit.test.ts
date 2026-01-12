import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { EarlyReturnError } from '../../../src/context.js';
import type { DataSource, UnitResolver } from '../../../src/types/index.js';

// Test fixtures directory
let testDir: string;

beforeAll(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-resolver-test-'));

  // Create a simple echo resolver (NONE data source)
  fs.writeFileSync(
    path.join(testDir, 'echoResolver.cjs'),
    `
    exports.request = function(ctx) {
      return ctx.arguments;
    };
    exports.response = function(ctx) {
      return ctx.prev.result;
    };
    `
  );

  // Create a resolver that transforms data
  fs.writeFileSync(
    path.join(testDir, 'transformResolver.cjs'),
    `
    exports.request = function(ctx) {
      return { input: ctx.arguments.name };
    };
    exports.response = function(ctx) {
      return {
        greeting: 'Hello, ' + (ctx.prev.result?.input || 'World'),
        timestamp: Date.now()
      };
    };
    `
  );

  // Create a resolver that uses stash
  fs.writeFileSync(
    path.join(testDir, 'stashResolver.cjs'),
    `
    exports.request = function(ctx) {
      ctx.stash.requestTime = Date.now();
      ctx.stash.userId = ctx.arguments.userId;
      return ctx.arguments;
    };
    exports.response = function(ctx) {
      return {
        result: ctx.prev.result,
        stash: ctx.stash
      };
    };
    `
  );

  // Create a resolver that uses identity
  fs.writeFileSync(
    path.join(testDir, 'identityResolver.cjs'),
    `
    exports.request = function(ctx) {
      return { userId: ctx.identity?.sub };
    };
    exports.response = function(ctx) {
      return {
        userId: ctx.prev.result?.userId,
        username: ctx.identity?.username,
        isAuthenticated: !!ctx.identity?.sub
      };
    };
    `
  );

  // Create a resolver that uses early return
  fs.writeFileSync(
    path.join(testDir, 'earlyReturnResolver.cjs'),
    `
    exports.request = function(ctx) {
      if (ctx.arguments.cached) {
        ctx.runtime.earlyReturn({ cached: true, data: 'from cache' });
      }
      return ctx.arguments;
    };
    exports.response = function(ctx) {
      return ctx.prev.result;
    };
    `
  );

  // Create a resolver with error handling
  fs.writeFileSync(
    path.join(testDir, 'errorResolver.cjs'),
    `
    exports.request = function(ctx) {
      if (ctx.arguments.shouldError) {
        ctx.util.error('Test error', 'TestErrorType');
      }
      return ctx.arguments;
    };
    exports.response = function(ctx) {
      return ctx.prev.result;
    };
    `
  );
});

afterAll(() => {
  // Clean up test fixtures
  if (testDir) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe('createUnitResolver', () => {
  const mockDataSources: DataSource[] = [{ type: 'NONE', name: 'NoneDS' }];

  it('should create a unit resolver function', async () => {
    const { createUnitResolver } = await import('../../../src/resolverHandlers/unit.js');

    const resolver: UnitResolver = {
      type: 'Query',
      field: 'echo',
      kind: 'Unit',
      dataSource: 'NoneDS',
      file: path.join(testDir, 'echoResolver.cjs'),
    };

    const resolverFn = await createUnitResolver(resolver, mockDataSources);
    expect(typeof resolverFn).toBe('function');
  });

  it('should execute resolver and return result', async () => {
    const { createUnitResolver } = await import('../../../src/resolverHandlers/unit.js');

    const resolver: UnitResolver = {
      type: 'Query',
      field: 'echo',
      kind: 'Unit',
      dataSource: 'NoneDS',
      file: path.join(testDir, 'echoResolver.cjs'),
    };

    const resolverFn = await createUnitResolver(resolver, mockDataSources);

    const result = await resolverFn(
      null,
      { message: 'hello', count: 42 },
      { headers: {} },
      { fieldName: 'echo', parentType: { name: 'Query' }, variableValues: {} }
    );

    expect(result).toEqual({ message: 'hello', count: 42 });
  });

  it('should transform data in response handler', async () => {
    const { createUnitResolver } = await import('../../../src/resolverHandlers/unit.js');

    const resolver: UnitResolver = {
      type: 'Query',
      field: 'greet',
      kind: 'Unit',
      dataSource: 'NoneDS',
      file: path.join(testDir, 'transformResolver.cjs'),
    };

    const resolverFn = await createUnitResolver(resolver, mockDataSources);

    const result = (await resolverFn(
      null,
      { name: 'Alice' },
      { headers: {} },
      { fieldName: 'greet', parentType: { name: 'Query' }, variableValues: {} }
    )) as { greeting: string; timestamp: number };

    expect(result.greeting).toBe('Hello, Alice');
    expect(typeof result.timestamp).toBe('number');
  });

  it('should maintain stash across request and response', async () => {
    const { createUnitResolver } = await import('../../../src/resolverHandlers/unit.js');

    const resolver: UnitResolver = {
      type: 'Query',
      field: 'withStash',
      kind: 'Unit',
      dataSource: 'NoneDS',
      file: path.join(testDir, 'stashResolver.cjs'),
    };

    const resolverFn = await createUnitResolver(resolver, mockDataSources);

    const result = (await resolverFn(
      null,
      { userId: 'user-123' },
      { headers: {} },
      { fieldName: 'withStash', parentType: { name: 'Query' }, variableValues: {} }
    )) as { result: unknown; stash: { userId: string; requestTime: number } };

    expect(result.stash.userId).toBe('user-123');
    expect(typeof result.stash.requestTime).toBe('number');
  });

  it('should pass identity to resolver context', async () => {
    const { createUnitResolver } = await import('../../../src/resolverHandlers/unit.js');

    const resolver: UnitResolver = {
      type: 'Query',
      field: 'me',
      kind: 'Unit',
      dataSource: 'NoneDS',
      file: path.join(testDir, 'identityResolver.cjs'),
    };

    const resolverFn = await createUnitResolver(resolver, mockDataSources);

    // Create a valid JWT token for testing
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({ sub: 'user-456', username: 'testuser' })).toString('base64');
    const token = `${header}.${payload}.signature`;

    const result = (await resolverFn(
      null,
      {},
      { headers: { authorization: `Bearer ${token}` } },
      { fieldName: 'me', parentType: { name: 'Query' }, variableValues: {} }
    )) as { userId: string; username: string; isAuthenticated: boolean };

    expect(result.userId).toBe('user-456');
    expect(result.isAuthenticated).toBe(true);
  });

  it('should handle early return from request handler', async () => {
    const { createUnitResolver } = await import('../../../src/resolverHandlers/unit.js');

    const resolver: UnitResolver = {
      type: 'Query',
      field: 'cached',
      kind: 'Unit',
      dataSource: 'NoneDS',
      file: path.join(testDir, 'earlyReturnResolver.cjs'),
    };

    const resolverFn = await createUnitResolver(resolver, mockDataSources);

    const result = (await resolverFn(
      null,
      { cached: true },
      { headers: {} },
      { fieldName: 'cached', parentType: { name: 'Query' }, variableValues: {} }
    )) as { cached: boolean; data: string };

    expect(result.cached).toBe(true);
    expect(result.data).toBe('from cache');
  });

  it('should pass parent data for nested field resolvers', async () => {
    const { createUnitResolver } = await import('../../../src/resolverHandlers/unit.js');

    // Create a resolver that uses source (parent)
    fs.writeFileSync(
      path.join(testDir, 'nestedResolver.cjs'),
      `
      exports.request = function(ctx) {
        return { parentId: ctx.source?.id };
      };
      exports.response = function(ctx) {
        return {
          parentId: ctx.prev.result?.parentId,
          source: ctx.source
        };
      };
      `
    );

    const resolver: UnitResolver = {
      type: 'User',
      field: 'posts',
      kind: 'Unit',
      dataSource: 'NoneDS',
      file: path.join(testDir, 'nestedResolver.cjs'),
    };

    const resolverFn = await createUnitResolver(resolver, mockDataSources);

    const parentUser = { id: 'user-789', name: 'Parent User' };
    const result = (await resolverFn(
      parentUser,
      {},
      { headers: {} },
      { fieldName: 'posts', parentType: { name: 'User' }, variableValues: {} }
    )) as {
      parentId: string;
      source: { id: string };
    };

    expect(result.parentId).toBe('user-789');
    expect(result.source.id).toBe('user-789');
  });
});

describe('Unit resolver context handling', () => {
  it('should provide all required context properties', async () => {
    const { createContext } = await import('../../../src/context.js');

    const ctx = createContext({
      arguments: { id: '123' },
      source: { parentId: 'parent-1' },
      identity: { sub: 'user-1', claims: {} },
      request: { headers: { 'content-type': 'application/json' } },
      info: { fieldName: 'test', parentTypeName: 'Query' },
    });

    expect(ctx.arguments).toEqual({ id: '123' });
    expect(ctx.source).toEqual({ parentId: 'parent-1' });
    expect(ctx.stash).toEqual({});
    expect(ctx.prev).toEqual({});

    expect(ctx.util).toBeDefined();
    expect(typeof ctx.util.autoId).toBe('function');
    expect(typeof ctx.util.time.nowISO8601).toBe('function');
    expect(typeof ctx.util.transform.toJson).toBe('function');

    expect(ctx.runtime).toBeDefined();
    expect(typeof ctx.runtime.earlyReturn).toBe('function');

    expect(ctx.extensions).toBeDefined();
    expect(typeof ctx.extensions.setSubscriptionFilter).toBe('function');
    expect(typeof ctx.extensions.setSubscriptionInvalidationFilter).toBe('function');
    expect(typeof ctx.extensions.invalidateSubscriptions).toBe('function');
    expect(typeof ctx.extensions.evictFromApiCache).toBe('function');
  });

  it('should extract identity from JWT headers', async () => {
    const { extractIdentityFromHeaders } = await import('../../../src/context.js');

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

    try {
      ctx.runtime.earlyReturn({ cached: true });
      expect(true).toBe(false);
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
    const { createContext, getExtensionsState, resetExtensionsState } = await import('../../../src/context.js');

    const ctx = createContext({ arguments: {} });

    ctx.extensions.setSubscriptionFilter({ postId: { eq: '123' } });

    let state = getExtensionsState();
    expect(state.subscriptionFilters.length).toBeGreaterThan(0);

    resetExtensionsState();
    state = getExtensionsState();
    expect(state.subscriptionFilters).toEqual([]);
    expect(state.subscriptionInvalidationFilters).toEqual([]);
    expect(state.invalidations).toEqual([]);
    expect(state.cacheEvictions).toEqual([]);
  });

  it('should track subscription filters', async () => {
    const { createContext, getExtensionsState, resetExtensionsState } = await import('../../../src/context.js');

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

    for (let i = 0; i < 5; i++) {
      ctx.extensions.invalidateSubscriptions({
        subscriptionField: `field${i}`,
        payload: { id: i },
      });
    }

    expect(() => {
      ctx.extensions.invalidateSubscriptions({
        subscriptionField: 'field6',
        payload: { id: 6 },
      });
    }).toThrow('Cannot call invalidateSubscriptions more than 5 times per request');
  });

  it('should track cache evictions', async () => {
    const { createContext, getExtensionsState, resetExtensionsState } = await import('../../../src/context.js');

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
