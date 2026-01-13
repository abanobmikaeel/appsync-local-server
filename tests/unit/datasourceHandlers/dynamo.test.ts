import { describe, expect, it, jest } from '@jest/globals';
import type { DynamoOperation } from '../../../src/types/index.js';

describe('DynamoDB Handler', () => {
  describe('module exports', () => {
    it('should export getDynamoClient', async () => {
      const { getDynamoClient } = await import('../../../src/datasourceHandlers/dynamo.js');
      expect(typeof getDynamoClient).toBe('function');
    });

    it('should export executeDynamoOperation', async () => {
      const { executeDynamoOperation } = await import('../../../src/datasourceHandlers/dynamo.js');
      expect(typeof executeDynamoOperation).toBe('function');
    });
  });

  describe('executeDynamoOperation', () => {
    it('should throw for unsupported operation', async () => {
      const { executeDynamoOperation } = await import('../../../src/datasourceHandlers/dynamo.js');

      // biome-ignore lint/suspicious/noExplicitAny: testing error handling
      const mockClient = { send: () => Promise.resolve({}) } as any;

      await expect(
        // biome-ignore lint/suspicious/noExplicitAny: testing error handling
        executeDynamoOperation(mockClient, 'UnsupportedOp' as any, {})
      ).rejects.toThrow('Unsupported Dynamo operation: UnsupportedOp');
    });

    // Test each operation type
    const operations: Array<{ op: DynamoOperation; name: string }> = [
      { op: 'GetItem', name: 'GetItem' },
      { op: 'PutItem', name: 'PutItem' },
      { op: 'UpdateItem', name: 'UpdateItem' },
      { op: 'DeleteItem', name: 'DeleteItem' },
      { op: 'Query', name: 'Query' },
      { op: 'Scan', name: 'Scan' },
      { op: 'BatchGetItem', name: 'BatchGetItem' },
      { op: 'BatchPutItem', name: 'BatchPutItem' },
      { op: 'BatchDeleteItem', name: 'BatchDeleteItem' },
      { op: 'TransactGetItems', name: 'TransactGetItems' },
      { op: 'TransactWriteItems', name: 'TransactWriteItems' },
      { op: 'Sync', name: 'Sync' },
    ];

    for (const { op, name } of operations) {
      it(`should handle ${name} operation`, async () => {
        const { executeDynamoOperation } = await import('../../../src/datasourceHandlers/dynamo.js');

        const mockResult = { Items: [], Count: 0 };
        // biome-ignore lint/suspicious/noExplicitAny: testing mock client
        const mockSend = jest.fn<() => Promise<any>>().mockResolvedValue(mockResult);
        // biome-ignore lint/suspicious/noExplicitAny: testing mock client
        const mockClient = { send: mockSend } as any;

        const result = await executeDynamoOperation(mockClient, op, { TableName: 'Test' });

        expect(mockSend).toHaveBeenCalled();
        expect(result).toEqual(mockResult);
      });
    }
  });

  describe('getDynamoClient', () => {
    it('should create client with minimal config', async () => {
      const { getDynamoClient } = await import('../../../src/datasourceHandlers/dynamo.js');

      const dataSource = {
        name: 'TestDS',
        type: 'DYNAMODB' as const,
        config: {
          tableName: 'TestTable',
          region: 'us-east-1',
        },
      };

      const client = getDynamoClient(dataSource);
      expect(client).toBeDefined();
      expect(typeof client.send).toBe('function');
    });

    it('should cache clients by data source name', async () => {
      const { getDynamoClient } = await import('../../../src/datasourceHandlers/dynamo.js');

      const dataSource = {
        name: 'CachedDS',
        type: 'DYNAMODB' as const,
        config: {
          tableName: 'CachedTable',
          region: 'us-east-1',
        },
      };

      const client1 = getDynamoClient(dataSource);
      const client2 = getDynamoClient(dataSource);

      expect(client1).toBe(client2);
    });

    it('should support endpoint configuration for local DynamoDB', async () => {
      const { getDynamoClient } = await import('../../../src/datasourceHandlers/dynamo.js');

      const dataSource = {
        name: 'LocalDS',
        type: 'DYNAMODB' as const,
        config: {
          tableName: 'LocalTable',
          region: 'us-east-1',
          endpoint: 'http://localhost:8000',
        },
      };

      const client = getDynamoClient(dataSource);
      expect(client).toBeDefined();
    });

    it('should support explicit credentials', async () => {
      const { getDynamoClient } = await import('../../../src/datasourceHandlers/dynamo.js');

      const dataSource = {
        name: 'CredentialsDS',
        type: 'DYNAMODB' as const,
        config: {
          tableName: 'CredTable',
          region: 'us-east-1',
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
      };

      const client = getDynamoClient(dataSource);
      expect(client).toBeDefined();
    });
  });
});
