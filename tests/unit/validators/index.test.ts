import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('validators/index', () => {
  let mockExit: ReturnType<typeof jest.spyOn>;
  let mockConsoleError: ReturnType<typeof jest.spyOn>;
  let mockConsoleLog: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.resetModules();
    mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleLog.mockRestore();
  });

  describe('validateConfig', () => {
    it('should exit with error for invalid config schema', async () => {
      const { validateConfig } = await import('../../../src/validators/index.js');

      // Pass an invalid config (missing required fields)
      expect(() => validateConfig({})).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith('Invalid config:');
    });

    it('should exit with error for config missing schema', async () => {
      const { validateConfig } = await import('../../../src/validators/index.js');

      const invalidConfig = {
        apiConfig: { auth: [{ type: 'API_KEY', key: 'test' }] },
        dataSources: [],
        resolvers: [],
      };

      expect(() => validateConfig(invalidConfig)).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit with error for config with non-existent schema file', async () => {
      const { validateConfig } = await import('../../../src/validators/index.js');

      const invalidConfig = {
        schema: 'non-existent-schema-file.graphql',
        apiConfig: { auth: [{ type: 'API_KEY', key: 'test' }] },
        dataSources: [{ type: 'NONE', name: 'NoneDS' }],
        resolvers: [],
      };

      expect(() => validateConfig(invalidConfig)).toThrow('process.exit called');
    });

    it('should validate and return valid config', async () => {
      const { validateConfig } = await import('../../../src/validators/index.js');

      // Use the schema and resolver from basic example which are compatible
      const validConfig = {
        schema: 'examples/basic/schema.graphql',
        apiConfig: { auth: [{ type: 'API_KEY', key: 'test' }] },
        dataSources: [{ type: 'NONE', name: 'NoneDS' }],
        resolvers: [
          {
            type: 'Query',
            field: 'echo',
            kind: 'Unit',
            dataSource: 'NoneDS',
            file: 'examples/basic/resolvers/echo.js',
          },
        ],
      };

      const result = validateConfig(validConfig);

      expect(result).toBeDefined();
      expect(result.schema).toBe('examples/basic/schema.graphql');
      expect(result.dataSources).toHaveLength(1);
    });
  });

  describe('exports', () => {
    it('should export validateAppSyncJavaScript', async () => {
      const mod = await import('../../../src/validators/index.js');
      expect(typeof mod.validateAppSyncJavaScript).toBe('function');
    });

    it('should export validateAllJavaScriptFiles', async () => {
      const mod = await import('../../../src/validators/index.js');
      expect(typeof mod.validateAllJavaScriptFiles).toBe('function');
    });

    it('should export validateGraphQL', async () => {
      const mod = await import('../../../src/validators/index.js');
      expect(typeof mod.validateGraphQL).toBe('function');
    });

    it('should export APPSYNC_RESTRICTIONS', async () => {
      const mod = await import('../../../src/validators/index.js');
      expect(mod.APPSYNC_RESTRICTIONS).toBeDefined();
    });

    it('should export ConfigSchema', async () => {
      const mod = await import('../../../src/validators/index.js');
      expect(mod.ConfigSchema).toBeDefined();
    });
  });
});
