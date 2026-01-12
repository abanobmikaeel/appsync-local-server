import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type {
  AppSyncConfig,
  LambdaDataSource,
  PipelineFunction,
  PipelineResolver,
  UnitResolver,
} from '../../../src/types/index.js';
import { collectJavaScriptFiles, validateAllJavaScriptFiles } from '../../../src/validators/fileValidator.js';

const defaultApiConfig = { auth: [{ type: 'API_KEY' as const, key: 'test-key' }] };

describe('collectJavaScriptFiles', () => {
  it('should collect unit resolver files', () => {
    const config: AppSyncConfig = {
      schema: 'schema.graphql',
      apiConfig: defaultApiConfig,
      dataSources: [{ type: 'NONE', name: 'NoneDS' }],
      resolvers: [
        {
          type: 'Query',
          field: 'getUser',
          kind: 'Unit',
          dataSource: 'NoneDS',
          file: 'resolvers/getUser.js',
        } as UnitResolver,
      ],
    };

    const result = collectJavaScriptFiles(config);

    expect(result.appSyncFiles.has('resolvers/getUser.js')).toBe(true);
    expect(result.dataSourceFiles.size).toBe(0);
  });

  it('should collect pipeline resolver files', () => {
    const pipelineFunctions: PipelineFunction[] = [
      { dataSource: 'NoneDS', file: 'functions/auth.js' },
      { dataSource: 'NoneDS', file: 'functions/validate.js' },
    ];

    const config: AppSyncConfig = {
      schema: 'schema.graphql',
      apiConfig: defaultApiConfig,
      dataSources: [{ type: 'NONE', name: 'NoneDS' }],
      resolvers: [
        {
          type: 'Query',
          field: 'pipelineQuery',
          kind: 'Pipeline',
          file: 'resolvers/pipeline.js',
          pipelineFunctions,
        } as PipelineResolver,
      ],
    };

    const result = collectJavaScriptFiles(config);

    expect(result.appSyncFiles.has('resolvers/pipeline.js')).toBe(true);
    expect(result.appSyncFiles.has('functions/auth.js')).toBe(true);
    expect(result.appSyncFiles.has('functions/validate.js')).toBe(true);
  });

  it('should collect Lambda data source files', () => {
    const config: AppSyncConfig = {
      schema: 'schema.graphql',
      apiConfig: defaultApiConfig,
      dataSources: [
        { type: 'NONE', name: 'NoneDS' },
        {
          type: 'LAMBDA',
          name: 'LambdaDS',
          config: { region: 'us-east-1', functionName: 'myFunction', file: 'lambdas/handler.js' },
        } as LambdaDataSource,
      ],
      resolvers: [],
    };

    const result = collectJavaScriptFiles(config);

    expect(result.dataSourceFiles.has('lambdas/handler.js')).toBe(true);
    expect(result.appSyncFiles.size).toBe(0);
  });

  it('should skip Lambda data sources without file', () => {
    const config: AppSyncConfig = {
      schema: 'schema.graphql',
      apiConfig: defaultApiConfig,
      dataSources: [
        {
          type: 'LAMBDA',
          name: 'LambdaDS',
          config: { region: 'us-east-1', functionName: 'myFunction' },
        } as LambdaDataSource,
      ],
      resolvers: [],
    };

    const result = collectJavaScriptFiles(config);

    expect(result.dataSourceFiles.size).toBe(0);
  });

  it('should handle mixed resolvers and data sources', () => {
    const config: AppSyncConfig = {
      schema: 'schema.graphql',
      apiConfig: defaultApiConfig,
      dataSources: [
        { type: 'NONE', name: 'NoneDS' },
        {
          type: 'LAMBDA',
          name: 'LambdaDS',
          config: { region: 'us-east-1', functionName: 'fn', file: 'lambda.js' },
        } as LambdaDataSource,
      ],
      resolvers: [
        { type: 'Query', field: 'get', kind: 'Unit', dataSource: 'NoneDS', file: 'get.js' } as UnitResolver,
        { type: 'Mutation', field: 'create', kind: 'Unit', dataSource: 'NoneDS', file: 'create.js' } as UnitResolver,
      ],
    };

    const result = collectJavaScriptFiles(config);

    expect(result.appSyncFiles.size).toBe(2);
    expect(result.dataSourceFiles.size).toBe(1);
  });
});

describe('validateAllJavaScriptFiles', () => {
  const tmpDir = os.tmpdir();
  const testDir = path.join(tmpDir, 'appsync-test-validators');
  let mockExit: ReturnType<typeof jest.spyOn>;
  let mockConsoleError: ReturnType<typeof jest.spyOn>;
  let mockConsoleLog: ReturnType<typeof jest.spyOn>;
  let mockConsoleWarn: ReturnType<typeof jest.spyOn>;

  // Create test directory and files before tests
  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a valid AppSync resolver file
    fs.writeFileSync(
      path.join(testDir, 'validResolver.js'),
      `export function request(ctx) { return {}; }\nexport function response(ctx) { return ctx.prev.result; }`
    );

    // Create a lambda data source file (doesn't need AppSync runtime rules)
    fs.writeFileSync(
      path.join(testDir, 'lambdaHandler.js'),
      `export const handler = async (event) => { return { statusCode: 200 }; };`
    );

    // Create a resolver file with validation errors (using throw which is disallowed)
    fs.writeFileSync(
      path.join(testDir, 'invalidResolver.js'),
      `export function request(ctx) { throw new Error('test'); }\nexport function response(ctx) { return ctx.prev.result; }`
    );

    // Create a resolver file with standard for loop (disallowed)
    fs.writeFileSync(
      path.join(testDir, 'forLoopResolver.js'),
      `export function request(ctx) { for (let i = 0; i < 10; i++) {} return {}; }\nexport function response(ctx) { return ctx.prev.result; }`
    );
  });

  // Clean up after tests
  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleWarn.mockRestore();
  });

  it('should validate valid resolver files without errors', () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      const config: AppSyncConfig = {
        schema: 'schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [{ type: 'NONE', name: 'NoneDS' }],
        resolvers: [
          {
            type: 'Query',
            field: 'test',
            kind: 'Unit',
            dataSource: 'NoneDS',
            file: 'validResolver.js',
          } as UnitResolver,
        ],
      };

      const result = validateAllJavaScriptFiles(config);

      expect(result.hasErrors).toBe(false);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should validate lambda data source files exist', () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      const config: AppSyncConfig = {
        schema: 'schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [
          {
            type: 'LAMBDA',
            name: 'LambdaDS',
            config: { region: 'us-east-1', functionName: 'fn', file: 'lambdaHandler.js' },
          } as LambdaDataSource,
        ],
        resolvers: [],
      };

      const result = validateAllJavaScriptFiles(config);

      expect(result.hasErrors).toBe(false);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should exit when resolver file has errors', () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      const config: AppSyncConfig = {
        schema: 'schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [{ type: 'NONE', name: 'NoneDS' }],
        resolvers: [
          {
            type: 'Query',
            field: 'test',
            kind: 'Unit',
            dataSource: 'NoneDS',
            file: 'invalidResolver.js',
          } as UnitResolver,
        ],
      };

      expect(() => validateAllJavaScriptFiles(config)).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should exit when resolver file does not exist', () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      const config: AppSyncConfig = {
        schema: 'schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [{ type: 'NONE', name: 'NoneDS' }],
        resolvers: [
          {
            type: 'Query',
            field: 'test',
            kind: 'Unit',
            dataSource: 'NoneDS',
            file: 'non-existent-resolver.js',
          } as UnitResolver,
        ],
      };

      expect(() => validateAllJavaScriptFiles(config)).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalled();
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should exit when data source file does not exist', () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      const config: AppSyncConfig = {
        schema: 'schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [
          {
            type: 'LAMBDA',
            name: 'LambdaDS',
            config: { region: 'us-east-1', functionName: 'fn', file: 'non-existent-lambda.js' },
          } as LambdaDataSource,
        ],
        resolvers: [],
      };

      expect(() => validateAllJavaScriptFiles(config)).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should exit when resolver uses disallowed for loop', () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      const config: AppSyncConfig = {
        schema: 'schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [{ type: 'NONE', name: 'NoneDS' }],
        resolvers: [
          {
            type: 'Query',
            field: 'test',
            kind: 'Unit',
            dataSource: 'NoneDS',
            file: 'forLoopResolver.js',
          } as UnitResolver,
        ],
      };

      expect(() => validateAllJavaScriptFiles(config)).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
