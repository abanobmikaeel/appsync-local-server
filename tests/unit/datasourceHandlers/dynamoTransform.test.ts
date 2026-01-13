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

    it('should transform PutItem request with condition expression', async () => {
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
        operation: 'PutItem',
        key: { id: '123' },
        attributeValues: { name: 'John' },
        condition: {
          expression: 'attribute_not_exists(id)',
          expressionNames: { '#id': 'id' },
          expressionValues: { ':val': 'test' },
        },
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        ConditionExpression: 'attribute_not_exists(id)',
        ExpressionAttributeNames: { '#id': 'id' },
        ExpressionAttributeValues: { ':val': 'test' },
      });
    });

    it('should transform GetItem request with projection', async () => {
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
        operation: 'GetItem',
        key: { id: '123' },
        projection: ['name', 'email', 'status'],
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        ProjectionExpression: '#p0, #p1, #p2',
        ExpressionAttributeNames: { '#p0': 'name', '#p1': 'email', '#p2': 'status' },
      });
    });

    it('should transform Scan request with nextToken pagination', async () => {
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

      const nextTokenData = { id: 'last-key-123' };
      const nextToken = Buffer.from(JSON.stringify(nextTokenData)).toString('base64');

      const request = {
        operation: 'Scan',
        nextToken,
        limit: 25,
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        ExclusiveStartKey: { id: 'last-key-123' },
        Limit: 25,
      });
    });

    it('should transform Scan request with parallel scan options', async () => {
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
        operation: 'Scan',
        totalSegments: 4,
        segment: 1,
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        TotalSegments: 4,
        Segment: 1,
      });
    });

    it('should transform Query request with select option', async () => {
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
          expression: 'pk = :pk',
          expressionValues: { ':pk': 'USER' },
        },
        select: 'COUNT',
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        Select: 'COUNT',
      });
    });

    it('should transform Sync request', async () => {
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
        operation: 'Sync',
        filter: {
          expression: '#status = :status',
          expressionNames: { '#status': 'status' },
          expressionValues: { ':status': 'active' },
        },
        limit: 100,
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        FilterExpression: '#status = :status',
        Limit: 100,
      });
    });

    it('should transform BatchGetItem request', async () => {
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
        operation: 'BatchGetItem',
        tables: {
          'users-table': { Keys: [{ id: '1' }, { id: '2' }] },
        },
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        RequestItems: {
          'users-table': { Keys: [{ id: '1' }, { id: '2' }] },
        },
      });
      // TableName should be removed for batch operations
      expect(params.TableName).toBeUndefined();
    });

    it('should transform TransactWriteItems request', async () => {
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
        operation: 'TransactWriteItems',
        transactItems: [{ Put: { TableName: 'users-table', Item: { id: '1' } } }],
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        TransactItems: [{ Put: { TableName: 'users-table', Item: { id: '1' } } }],
      });
    });

    it('should transform UpdateItem request with condition', async () => {
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
          expressionValues: { ':name': 'Jane' },
        },
        condition: {
          expression: '#version = :version',
          expressionNames: { '#version': 'version' },
          expressionValues: { ':version': 1 },
        },
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        ConditionExpression: '#version = :version',
        ExpressionAttributeNames: { '#version': 'version' },
      });
    });

    it('should transform DeleteItem request with condition', async () => {
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
        condition: {
          expression: 'attribute_exists(id)',
        },
      };

      const result = await executeDataSource('UsersTable', dataSources, request);
      const params = (result as { _testParams: Record<string, unknown> })._testParams;

      expect(params).toMatchObject({
        ConditionExpression: 'attribute_exists(id)',
      });
    });
  });
});
