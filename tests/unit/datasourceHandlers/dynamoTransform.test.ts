import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock the dynamo module to capture what params are sent
jest.unstable_mockModule('../../../src/datasourceHandlers/dynamo.js', () => ({
  getDynamoClient: jest.fn().mockReturnValue({ send: jest.fn() }),
  executeDynamoOperation: jest.fn().mockImplementation(async (_client, _op, params) => {
    // Return the params so we can inspect them
    return { _testParams: params };
  }),
}));

describe('DynamoDB Request Transformation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeDataSource with DYNAMODB', () => {
    it('should inject TableName from data source config for scan({})', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');

      const dataSources = [
        {
          name: 'UsersTable',
          type: 'DYNAMODB' as const,
          config: {
            tableName: 'users-table',
            region: 'us-east-1',
          },
        },
      ];

      // This is what scan({}) returns from @aws-appsync/utils/dynamodb
      const request = { operation: 'Scan' };

      const result = await executeDataSource('UsersTable', dataSources, request);

      // Verify TableName was injected
      expect((result as { _testParams: Record<string, unknown> })._testParams).toMatchObject({
        TableName: 'users-table',
      });
    });

    it('should transform scan with limit and filter', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');

      const dataSources = [
        {
          name: 'UsersTable',
          type: 'DYNAMODB' as const,
          config: {
            tableName: 'users-table',
            region: 'us-east-1',
          },
        },
      ];

      // This is what scan({ limit: 10, filter: {...} }) returns
      const request = {
        operation: 'Scan',
        limit: 10,
        filter: {
          expression: '#status = :status',
          expressionNames: { '#status': 'status' },
          expressionValues: { ':status': 'active' },
        },
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        TableName: 'users-table',
        Limit: 10,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'active' },
      });
    });

    it('should transform GetItem request with key', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');

      const dataSources = [
        {
          name: 'UsersTable',
          type: 'DYNAMODB' as const,
          config: {
            tableName: 'users-table',
            region: 'us-east-1',
          },
        },
      ];

      // This is what get({ key: { id: '123' } }) returns
      const request = {
        operation: 'GetItem',
        key: { id: '123' },
        consistentRead: true,
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        TableName: 'users-table',
        Key: { id: '123' },
        ConsistentRead: true,
      });
    });

    it('should transform PutItem request', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');

      const dataSources = [
        {
          name: 'UsersTable',
          type: 'DYNAMODB' as const,
          config: {
            tableName: 'users-table',
            region: 'us-east-1',
          },
        },
      ];

      // This is what put({ key: { id }, item: { name, email } }) returns
      const request = {
        operation: 'PutItem',
        key: { id: '123' },
        attributeValues: { name: 'John', email: 'john@example.com' },
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        TableName: 'users-table',
        Item: { id: '123', name: 'John', email: 'john@example.com' },
      });
    });

    it('should transform UpdateItem request', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');

      const dataSources = [
        {
          name: 'UsersTable',
          type: 'DYNAMODB' as const,
          config: {
            tableName: 'users-table',
            region: 'us-east-1',
          },
        },
      ];

      const request = {
        operation: 'UpdateItem',
        key: { id: '123' },
        update: {
          expression: 'SET #name = :name',
          expressionNames: { '#name': 'name' },
          expressionValues: { ':name': 'Jane' },
        },
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        TableName: 'users-table',
        Key: { id: '123' },
        UpdateExpression: 'SET #name = :name',
        ExpressionAttributeNames: { '#name': 'name' },
        ExpressionAttributeValues: { ':name': 'Jane' },
        ReturnValues: 'ALL_NEW',
      });
    });

    it('should transform DeleteItem request', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');

      const dataSources = [
        {
          name: 'UsersTable',
          type: 'DYNAMODB' as const,
          config: {
            tableName: 'users-table',
            region: 'us-east-1',
          },
        },
      ];

      const request = {
        operation: 'DeleteItem',
        key: { id: '123' },
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        TableName: 'users-table',
        Key: { id: '123' },
      });
    });

    it('should transform Query request', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');

      const dataSources = [
        {
          name: 'UsersTable',
          type: 'DYNAMODB' as const,
          config: {
            tableName: 'users-table',
            region: 'us-east-1',
          },
        },
      ];

      const request = {
        operation: 'Query',
        query: {
          expression: '#pk = :pk',
          expressionNames: { '#pk': 'pk' },
          expressionValues: { ':pk': 'USER#123' },
        },
        index: 'GSI1',
        limit: 20,
        scanIndexForward: false,
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        TableName: 'users-table',
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: { '#pk': 'pk' },
        ExpressionAttributeValues: { ':pk': 'USER#123' },
        IndexName: 'GSI1',
        Limit: 20,
        ScanIndexForward: false,
      });
    });

    it('should throw error for unknown data source', async () => {
      const { executeDataSource } = await import('../../../src/datasourceHandlers/index.js');

      const dataSources = [
        {
          name: 'UsersTable',
          type: 'DYNAMODB' as const,
          config: {
            tableName: 'users-table',
            region: 'us-east-1',
          },
        },
      ];

      await expect(executeDataSource('UnknownTable', dataSources, { operation: 'Scan' })).rejects.toThrow(
        "Data source 'UnknownTable' not found"
      );
    });
  });
});
