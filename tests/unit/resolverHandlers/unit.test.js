import { createUnitResolver } from '../../../src/resolverHandlers/unit.js';
import { loadResolverModule } from '../../../src/imports.js';

// Mock the imports module
jest.mock('../../../src/imports.js');

describe('Unit Resolver Handler', () => {
  let mockDocClient;
  let mockDataSources;

  beforeEach(() => {
    mockDocClient = {
      send: jest.fn()
    };

    mockDataSources = [
      {
        name: 'testTable',
        type: 'DYNAMODB',
        config: {
          tableName: 'test-table',
          region: 'us-east-1'
        }
      },
      {
        name: 'noneDataSource',
        type: 'NONE'
      }
    ];

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('createUnitResolver', () => {
    it('should create a unit resolver for NONE data source', async () => {
      const mockModule = {
        request: jest.fn().mockResolvedValue('test request'),
        response: jest.fn().mockResolvedValue('test response')
      };

      loadResolverModule.mockResolvedValue(mockModule);

      const resolver = {
        type: 'Query',
        field: 'test',
        kind: 'Unit',
        dataSource: 'noneDataSource',
        file: './test-resolver.js'
      };

      const unitResolver = await createUnitResolver(mockDocClient, resolver, mockDataSources);
      
      // Test the resolver function
      const args = { id: '123' };
      const result = await unitResolver(null, args);

      expect(loadResolverModule).toHaveBeenCalledWith('./test-resolver.js');
      expect(mockModule.request).toHaveBeenCalledWith({
        arguments: args,
        stash: {},
        prev: {},
        util: {},
        env: process.env
      });
      expect(mockModule.response).toHaveBeenCalledWith({
        arguments: args,
        stash: {},
        prev: { result: 'test request' },
        util: {},
        env: process.env
      });
      expect(result).toBe('test response');
    });

    it('should create a unit resolver for DYNAMODB data source', async () => {
      const mockModule = {
        request: jest.fn().mockResolvedValue({
          operation: 'GetItem',
          params: {
            TableName: 'test-table',
            Key: { id: { S: '123' } }
          }
        }),
        response: jest.fn().mockResolvedValue({ id: '123', name: 'Test' })
      };

      loadResolverModule.mockResolvedValue(mockModule);
      mockDocClient.send.mockResolvedValue({ Item: { id: { S: '123' }, name: { S: 'Test' } } });

      const resolver = {
        type: 'Query',
        field: 'getUser',
        kind: 'Unit',
        dataSource: 'testTable',
        file: './get-user-resolver.js'
      };

      const unitResolver = await createUnitResolver(mockDocClient, resolver, mockDataSources);
      
      const args = { id: '123' };
      const result = await unitResolver(null, args);

      expect(mockModule.request).toHaveBeenCalled();
      expect(mockDocClient.send).toHaveBeenCalled();
      expect(mockModule.response).toHaveBeenCalledWith({
        arguments: args,
        stash: {},
        prev: { result: { Item: { id: { S: '123' }, name: { S: 'Test' } } } },
        util: {},
        env: process.env
      });
      expect(result).toEqual({ id: '123', name: 'Test' });
    });

    it('should handle errors in request function', async () => {
      const mockModule = {
        request: jest.fn().mockRejectedValue(new Error('Request error')),
        response: jest.fn()
      };

      loadResolverModule.mockResolvedValue(mockModule);

      const resolver = {
        type: 'Query',
        field: 'test',
        kind: 'Unit',
        dataSource: 'noneDataSource',
        file: './test-resolver.js'
      };

      const unitResolver = await createUnitResolver(mockDocClient, resolver, mockDataSources);
      
      await expect(unitResolver(null, {})).rejects.toThrow('Request error');
      expect(mockModule.response).not.toHaveBeenCalled();
    });

    it('should handle errors in response function', async () => {
      const mockModule = {
        request: jest.fn().mockResolvedValue('test request'),
        response: jest.fn().mockRejectedValue(new Error('Response error'))
      };

      loadResolverModule.mockResolvedValue(mockModule);

      const resolver = {
        type: 'Query',
        field: 'test',
        kind: 'Unit',
        dataSource: 'noneDataSource',
        file: './test-resolver.js'
      };

      const unitResolver = await createUnitResolver(mockDocClient, resolver, mockDataSources);
      
      await expect(unitResolver(null, {})).rejects.toThrow('Response error');
    });

    it('should handle data source not found', async () => {
      const mockModule = {
        request: jest.fn().mockResolvedValue('test request'),
        response: jest.fn().mockResolvedValue('test response')
      };

      loadResolverModule.mockResolvedValue(mockModule);

      const resolver = {
        type: 'Query',
        field: 'test',
        kind: 'Unit',
        dataSource: 'nonExistentDataSource',
        file: './test-resolver.js'
      };

      const unitResolver = await createUnitResolver(mockDocClient, resolver, mockDataSources);
      
      await expect(unitResolver(null, {})).rejects.toThrow('Data source \'nonExistentDataSource\' not found');
    });

    it('should pass correct context to request and response functions', async () => {
      const mockModule = {
        request: jest.fn().mockResolvedValue('test request'),
        response: jest.fn().mockResolvedValue('test response')
      };

      loadResolverModule.mockResolvedValue(mockModule);

      const resolver = {
        type: 'Query',
        field: 'test',
        kind: 'Unit',
        dataSource: 'noneDataSource',
        file: './test-resolver.js'
      };

      const unitResolver = await createUnitResolver(mockDocClient, resolver, mockDataSources);
      
      const args = { id: '123', name: 'Test' };
      await unitResolver(null, args);

      // Check that request was called with correct context
      expect(mockModule.request).toHaveBeenCalledWith({
        arguments: args,
        stash: {},
        prev: {},
        util: {},
        env: process.env
      });

      // Check that response was called with correct context including prev result
      expect(mockModule.response).toHaveBeenCalledWith({
        arguments: args,
        stash: {},
        prev: { result: 'test request' },
        util: {},
        env: process.env
      });
    });
  });
}); 