import { describe, expect, it } from '@jest/globals';
import type { DataSource } from '../../../src/types/index.js';

describe('Data Source Index', () => {
  describe('executeDataSource', () => {
    it('should be importable', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');
      expect(typeof executeDataSource).toBe('function');
    });

    it('should throw error if data source not found', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');

      const dataSources: DataSource[] = [{ name: 'ExistingDS', type: 'NONE' }];

      await expect(executeDataSource('NonExistent', dataSources, {})).rejects.toThrow(
        "Data source 'NonExistent' not found"
      );
    });

    it('should return request as-is for NONE data source', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');

      const dataSources: DataSource[] = [{ name: 'LocalResolver', type: 'NONE' }];

      const request = { data: 'passthrough', computed: 123 };
      const result = await executeDataSource('LocalResolver', dataSources, request);

      expect(result).toEqual(request);
    });

    it('should handle NONE data source with complex objects', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');

      const dataSources: DataSource[] = [{ name: 'NoneDS', type: 'NONE' }];

      const complexRequest = {
        nested: { data: { value: 42 } },
        array: [1, 2, 3],
        nullValue: null,
      };

      const result = await executeDataSource('NoneDS', dataSources, complexRequest);

      expect(result).toEqual(complexRequest);
    });
  });

  describe('data source type routing', () => {
    it('should handle null request for NONE data source', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');

      const dataSources: DataSource[] = [{ name: 'NoneDS', type: 'NONE' }];

      const result = await executeDataSource('NoneDS', dataSources, null);
      expect(result).toBeNull();
    });

    it('should handle undefined request for NONE data source', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');

      const dataSources: DataSource[] = [{ name: 'NoneDS', type: 'NONE' }];

      const result = await executeDataSource('NoneDS', dataSources, undefined);
      expect(result).toBeUndefined();
    });

    it('should find data source by name among many', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');

      const dataSources: DataSource[] = [
        { name: 'First', type: 'NONE' },
        { name: 'Second', type: 'NONE' },
        { name: 'Target', type: 'NONE' },
        { name: 'Last', type: 'NONE' },
      ];

      const request = { found: true };
      const result = await executeDataSource('Target', dataSources, request);
      expect(result).toEqual(request);
    });
  });

  describe('unsupported data source types', () => {
    it('should throw error for unsupported data source type', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');

      // Create a data source with an invalid type
      const dataSources = [{ name: 'BadDS', type: 'UNKNOWN_TYPE' }] as unknown as DataSource[];

      await expect(executeDataSource('BadDS', dataSources, {})).rejects.toThrow(
        'Unsupported data source type: UNKNOWN_TYPE'
      );
    });
  });

  describe('exports', () => {
    it('should export executeDynamoOperation', async () => {
      const mod = await import('../../../src/datasourceHandlers/index.js');
      expect(typeof mod.executeDynamoOperation).toBe('function');
    });

    it('should export executeLambdaOperation', async () => {
      const mod = await import('../../../src/datasourceHandlers/index.js');
      expect(typeof mod.executeLambdaOperation).toBe('function');
    });

    it('should export executeHTTPOperation', async () => {
      const mod = await import('../../../src/datasourceHandlers/index.js');
      expect(typeof mod.executeHTTPOperation).toBe('function');
    });

    it('should export executeRDSOperation', async () => {
      const mod = await import('../../../src/datasourceHandlers/index.js');
      expect(typeof mod.executeRDSOperation).toBe('function');
    });

    it('should export httpRequest helper', async () => {
      const mod = await import('../../../src/datasourceHandlers/index.js');
      expect(mod.httpRequest).toBeDefined();
    });

    it('should export rdsRequest helper', async () => {
      const mod = await import('../../../src/datasourceHandlers/index.js');
      expect(mod.rdsRequest).toBeDefined();
    });

    it('should export closeAllPools', async () => {
      const mod = await import('../../../src/datasourceHandlers/index.js');
      expect(typeof mod.closeAllPools).toBe('function');
    });
  });
});
