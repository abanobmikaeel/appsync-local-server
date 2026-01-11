import { describe, expect, it } from '@jest/globals';

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
