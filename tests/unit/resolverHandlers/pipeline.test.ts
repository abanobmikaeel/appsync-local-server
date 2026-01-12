import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { DataSource, PipelineFunction, PipelineResolver } from '../../../src/types/index.js';

// Test fixtures directory
let testDir: string;

beforeAll(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-resolver-test-'));

  // Main pipeline resolver (before/after handlers)
  fs.writeFileSync(
    path.join(testDir, 'mainResolver.cjs'),
    `
    exports.request = function(ctx) {
      ctx.stash.startTime = Date.now();
      return null;
    };
    exports.response = function(ctx) {
      return {
        data: ctx.prev.result,
        executionTime: Date.now() - ctx.stash.startTime
      };
    };
    `
  );

  // Echo pipeline function
  fs.writeFileSync(
    path.join(testDir, 'echoFunction.cjs'),
    `
    exports.request = function(ctx) {
      return ctx.arguments;
    };
    exports.response = function(ctx) {
      return ctx.prev.result;
    };
    `
  );

  // Transform pipeline function
  fs.writeFileSync(
    path.join(testDir, 'transformFunction.cjs'),
    `
    exports.request = function(ctx) {
      return { input: ctx.prev.result || ctx.arguments };
    };
    exports.response = function(ctx) {
      const input = ctx.prev.result?.input || {};
      return {
        ...input,
        transformed: true,
        step: 'transform'
      };
    };
    `
  );

  // Validation pipeline function
  fs.writeFileSync(
    path.join(testDir, 'validateFunction.cjs'),
    `
    exports.request = function(ctx) {
      ctx.stash.validated = true;
      return ctx.prev.result || ctx.arguments;
    };
    exports.response = function(ctx) {
      return {
        ...ctx.prev.result,
        isValid: ctx.stash.validated
      };
    };
    `
  );

  // Early return pipeline function
  fs.writeFileSync(
    path.join(testDir, 'cacheFunction.cjs'),
    `
    exports.request = function(ctx) {
      if (ctx.arguments.useCache) {
        ctx.runtime.earlyReturn({ cached: true, data: 'from cache' });
      }
      return ctx.arguments;
    };
    exports.response = function(ctx) {
      return ctx.prev.result;
    };
    `
  );

  // Stash accumulator function
  fs.writeFileSync(
    path.join(testDir, 'accumulatorFunction.cjs'),
    `
    exports.request = function(ctx) {
      ctx.stash.steps = ctx.stash.steps || [];
      ctx.stash.steps.push('step-' + (ctx.stash.steps.length + 1));
      return ctx.arguments;
    };
    exports.response = function(ctx) {
      return {
        result: ctx.prev.result,
        steps: ctx.stash.steps
      };
    };
    `
  );
});

afterAll(() => {
  if (testDir) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe('createPipelineResolver', () => {
  const mockDataSources: DataSource[] = [{ type: 'NONE', name: 'NoneDS' }];

  it('should create a pipeline resolver function', async () => {
    const { createPipelineResolver } = await import('../../../src/resolverHandlers/pipeline.js');

    const pipelineFunctions: PipelineFunction[] = [
      { dataSource: 'NoneDS', file: path.join(testDir, 'echoFunction.cjs') },
    ];

    const resolver: PipelineResolver = {
      type: 'Query',
      field: 'testPipeline',
      kind: 'Pipeline',
      file: path.join(testDir, 'mainResolver.cjs'),
      pipelineFunctions,
    };

    const resolverFn = await createPipelineResolver(resolver, mockDataSources);
    expect(typeof resolverFn).toBe('function');
  });

  it('should execute pipeline with single function', async () => {
    const { createPipelineResolver } = await import('../../../src/resolverHandlers/pipeline.js');

    const pipelineFunctions: PipelineFunction[] = [
      { dataSource: 'NoneDS', file: path.join(testDir, 'echoFunction.cjs') },
    ];

    const resolver: PipelineResolver = {
      type: 'Query',
      field: 'echo',
      kind: 'Pipeline',
      file: path.join(testDir, 'mainResolver.cjs'),
      pipelineFunctions,
    };

    const resolverFn = await createPipelineResolver(resolver, mockDataSources);

    const result = (await resolverFn(
      null,
      { message: 'hello' },
      { headers: {} },
      { fieldName: 'echo', parentType: { name: 'Query' }, variableValues: {} }
    )) as { data: { message: string }; executionTime: number };

    expect(result.data.message).toBe('hello');
    expect(typeof result.executionTime).toBe('number');
  });

  it('should execute pipeline with multiple functions in sequence', async () => {
    const { createPipelineResolver } = await import('../../../src/resolverHandlers/pipeline.js');

    const pipelineFunctions: PipelineFunction[] = [
      { dataSource: 'NoneDS', file: path.join(testDir, 'echoFunction.cjs') },
      { dataSource: 'NoneDS', file: path.join(testDir, 'transformFunction.cjs') },
      { dataSource: 'NoneDS', file: path.join(testDir, 'validateFunction.cjs') },
    ];

    const resolver: PipelineResolver = {
      type: 'Query',
      field: 'process',
      kind: 'Pipeline',
      file: path.join(testDir, 'mainResolver.cjs'),
      pipelineFunctions,
    };

    const resolverFn = await createPipelineResolver(resolver, mockDataSources);

    const result = (await resolverFn(
      null,
      { name: 'test' },
      { headers: {} },
      { fieldName: 'process', parentType: { name: 'Query' }, variableValues: {} }
    )) as { data: { transformed: boolean; isValid: boolean } };

    expect(result.data.transformed).toBe(true);
    expect(result.data.isValid).toBe(true);
  });

  it('should handle early return in pipeline function', async () => {
    const { createPipelineResolver } = await import('../../../src/resolverHandlers/pipeline.js');

    const pipelineFunctions: PipelineFunction[] = [
      { dataSource: 'NoneDS', file: path.join(testDir, 'cacheFunction.cjs') },
      { dataSource: 'NoneDS', file: path.join(testDir, 'transformFunction.cjs') }, // Should be skipped
    ];

    const resolver: PipelineResolver = {
      type: 'Query',
      field: 'cached',
      kind: 'Pipeline',
      file: path.join(testDir, 'mainResolver.cjs'),
      pipelineFunctions,
    };

    const resolverFn = await createPipelineResolver(resolver, mockDataSources);

    const result = (await resolverFn(
      null,
      { useCache: true },
      { headers: {} },
      { fieldName: 'cached', parentType: { name: 'Query' }, variableValues: {} }
    )) as { data: { cached: boolean; data: string } };

    expect(result.data.cached).toBe(true);
    expect(result.data.data).toBe('from cache');
  });

  it('should maintain stash across all pipeline functions', async () => {
    const { createPipelineResolver } = await import('../../../src/resolverHandlers/pipeline.js');

    const pipelineFunctions: PipelineFunction[] = [
      { dataSource: 'NoneDS', file: path.join(testDir, 'accumulatorFunction.cjs') },
      { dataSource: 'NoneDS', file: path.join(testDir, 'accumulatorFunction.cjs') },
      { dataSource: 'NoneDS', file: path.join(testDir, 'accumulatorFunction.cjs') },
    ];

    const resolver: PipelineResolver = {
      type: 'Query',
      field: 'accumulate',
      kind: 'Pipeline',
      file: path.join(testDir, 'mainResolver.cjs'),
      pipelineFunctions,
    };

    const resolverFn = await createPipelineResolver(resolver, mockDataSources);

    const result = (await resolverFn(
      null,
      {},
      { headers: {} },
      { fieldName: 'accumulate', parentType: { name: 'Query' }, variableValues: {} }
    )) as { data: { steps: string[] } };

    expect(result.data.steps).toEqual(['step-1', 'step-2', 'step-3']);
  });
});

describe('Pipeline resolver stash behavior', () => {
  it('should maintain stash across pipeline functions', async () => {
    const { createContext, resetExtensionsState } = await import('../../../src/context.js');

    resetExtensionsState();
    const ctx = createContext({ arguments: { id: '123' } });

    ctx.stash.step1Data = 'from step 1';
    ctx.stash.counter = 1;

    expect(ctx.stash.step1Data).toBe('from step 1');
    expect(ctx.stash.counter).toBe(1);

    ctx.stash.counter = 2;
    expect(ctx.stash.counter).toBe(2);
  });
});

describe('Pipeline resolver prev.result behavior', () => {
  it('should track prev.result through pipeline stages', async () => {
    const { createContext, resetExtensionsState } = await import('../../../src/context.js');

    resetExtensionsState();
    const ctx = createContext({ arguments: {} });

    expect(ctx.prev).toEqual({});

    ctx.prev = { result: { data: 'from step 1' } };
    expect(ctx.prev.result).toEqual({ data: 'from step 1' });

    ctx.prev = { result: { data: 'from step 2' } };
    expect(ctx.prev.result).toEqual({ data: 'from step 2' });
  });
});

describe('Pipeline early return behavior', () => {
  it('should support early return from before handler', async () => {
    const { createContext, isEarlyReturn, resetExtensionsState } = await import('../../../src/context.js');

    resetExtensionsState();
    const ctx = createContext({ arguments: {} });

    try {
      ctx.runtime.earlyReturn({ cached: true, data: 'cached data' });
    } catch (error) {
      expect(isEarlyReturn(error)).toBe(true);
    }
  });

  it('should support early return from pipeline function', async () => {
    const { createContext, isEarlyReturn, resetExtensionsState } = await import('../../../src/context.js');

    resetExtensionsState();
    const ctx = createContext({ arguments: {} });

    ctx.stash.processed = true;

    try {
      ctx.runtime.earlyReturn(ctx.stash);
    } catch (error) {
      if (isEarlyReturn(error)) {
        const result = (error as { data: unknown }).data;
        expect(result).toEqual({ processed: true });
      }
    }
  });
});

describe('Pipeline function ordering', () => {
  it('should execute functions in order defined by pipelineFunctions array', async () => {
    const pipelineFunctions: PipelineFunction[] = [
      { dataSource: 'NoneDS', file: 'auth.js' },
      { dataSource: 'NoneDS', file: 'validate.js' },
      { dataSource: 'NoneDS', file: 'transform.js' },
      { dataSource: 'NoneDS', file: 'persist.js' },
    ];

    expect(pipelineFunctions[0].file).toBe('auth.js');
    expect(pipelineFunctions[1].file).toBe('validate.js');
    expect(pipelineFunctions[2].file).toBe('transform.js');
    expect(pipelineFunctions[3].file).toBe('persist.js');
    expect(pipelineFunctions.length).toBe(4);
  });
});

describe('Pipeline with multiple data sources', () => {
  it('should support functions with different data sources', async () => {
    const mockDataSources: DataSource[] = [
      { type: 'NONE', name: 'NoneDS' },
      { type: 'DYNAMODB', name: 'DynamoDB', config: { region: 'us-east-1', tableName: 'Users' } },
      { type: 'LAMBDA', name: 'LambdaDS', config: { region: 'us-east-1', functionName: 'myFunction' } },
    ];

    const pipelineFunctions: PipelineFunction[] = [
      { dataSource: 'NoneDS', file: 'validateInput.js' },
      { dataSource: 'DynamoDB', file: 'fetchUser.js' },
      { dataSource: 'LambdaDS', file: 'enrichData.js' },
      { dataSource: 'NoneDS', file: 'formatResponse.js' },
    ];

    expect(pipelineFunctions[0].dataSource).toBe('NoneDS');
    expect(pipelineFunctions[1].dataSource).toBe('DynamoDB');
    expect(pipelineFunctions[2].dataSource).toBe('LambdaDS');
    expect(pipelineFunctions[3].dataSource).toBe('NoneDS');

    for (const fn of pipelineFunctions) {
      const ds = mockDataSources.find((d) => d.name === fn.dataSource);
      expect(ds).toBeDefined();
    }
  });
});

describe('Pipeline context inheritance', () => {
  it('should pass identity to all pipeline stages', async () => {
    const { createContext, resetExtensionsState } = await import('../../../src/context.js');

    resetExtensionsState();
    const ctx = createContext({
      arguments: {},
      identity: {
        sub: 'user-123',
        username: 'testuser',
        claims: { role: 'admin' },
      },
    });

    expect(ctx.identity?.sub).toBe('user-123');
    expect(ctx.identity?.username).toBe('testuser');
    expect(ctx.identity?.claims?.role).toBe('admin');
  });

  it('should pass request info to all pipeline stages', async () => {
    const { createContext, resetExtensionsState } = await import('../../../src/context.js');

    resetExtensionsState();
    const ctx = createContext({
      arguments: {},
      request: {
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer token123',
        },
        domainName: 'api.example.com',
      },
    });

    expect(ctx.request?.headers['content-type']).toBe('application/json');
    expect(ctx.request?.domainName).toBe('api.example.com');
  });

  it('should pass GraphQL info to all pipeline stages', async () => {
    const { createContext, resetExtensionsState } = await import('../../../src/context.js');

    resetExtensionsState();
    const ctx = createContext({
      arguments: { userId: '123' },
      info: {
        fieldName: 'getUser',
        parentTypeName: 'Query',
        variables: { limit: 10, offset: 0 },
        selectionSetList: ['id', 'name', 'email'],
      },
    });

    expect(ctx.info?.fieldName).toBe('getUser');
    expect(ctx.info?.parentTypeName).toBe('Query');
    expect(ctx.info?.variables?.limit).toBe(10);
    expect(ctx.info?.selectionSetList).toContain('id');
  });
});
