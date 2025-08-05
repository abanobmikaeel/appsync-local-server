import { executeDynamoOperation } from '../../../src/datasourceHandlers/dynamo.js';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Mock the DynamoDB client
jest.mock('@aws-sdk/lib-dynamodb');

describe('DynamoDB Data Source Handler', () => {
  let mockDocClient;

  beforeEach(() => {
    mockDocClient = {
      send: jest.fn()
    };
    DynamoDBDocumentClient.from.mockReturnValue(mockDocClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeDynamoOperation', () => {
    it('should execute GetItem operation', async () => {
      const mockResponse = { Item: { id: '123', name: 'Test' } };
      mockDocClient.send.mockResolvedValue(mockResponse);

      const result = await executeDynamoOperation(mockDocClient, 'GetItem', {
        TableName: 'test-table',
        Key: { id: { S: '123' } }
      });

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: 'test-table',
            Key: { id: { S: '123' } }
          }
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should execute PutItem operation', async () => {
      const mockResponse = { };
      mockDocClient.send.mockResolvedValue(mockResponse);

      const result = await executeDynamoOperation(mockDocClient, 'PutItem', {
        TableName: 'test-table',
        Item: { id: '123', name: 'Test' }
      });

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: 'test-table',
            Item: { id: '123', name: 'Test' }
          }
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should execute UpdateItem operation', async () => {
      const mockResponse = { Attributes: { id: '123', name: 'Updated' } };
      mockDocClient.send.mockResolvedValue(mockResponse);

      const result = await executeDynamoOperation(mockDocClient, 'UpdateItem', {
        TableName: 'test-table',
        Key: { id: { S: '123' } },
        UpdateExpression: 'SET #n = :name',
        ExpressionAttributeNames: { '#n': 'name' },
        ExpressionAttributeValues: { ':name': { S: 'Updated' } }
      });

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: 'test-table',
            Key: { id: { S: '123' } },
            UpdateExpression: 'SET #n = :name',
            ExpressionAttributeNames: { '#n': 'name' },
            ExpressionAttributeValues: { ':name': { S: 'Updated' } }
          }
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should execute DeleteItem operation', async () => {
      const mockResponse = { };
      mockDocClient.send.mockResolvedValue(mockResponse);

      const result = await executeDynamoOperation(mockDocClient, 'DeleteItem', {
        TableName: 'test-table',
        Key: { id: { S: '123' } }
      });

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: 'test-table',
            Key: { id: { S: '123' } }
          }
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should execute Query operation', async () => {
      const mockResponse = { Items: [{ id: '123', name: 'Test' }] };
      mockDocClient.send.mockResolvedValue(mockResponse);

      const result = await executeDynamoOperation(mockDocClient, 'Query', {
        TableName: 'test-table',
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': { S: '123' } }
      });

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: 'test-table',
            KeyConditionExpression: 'id = :id',
            ExpressionAttributeValues: { ':id': { S: '123' } }
          }
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should execute Scan operation', async () => {
      const mockResponse = { Items: [{ id: '123', name: 'Test' }] };
      mockDocClient.send.mockResolvedValue(mockResponse);

      const result = await executeDynamoOperation(mockDocClient, 'Scan', {
        TableName: 'test-table'
      });

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: 'test-table'
          }
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should execute BatchGetItem operation', async () => {
      const mockResponse = { Responses: { 'test-table': [{ id: '123', name: 'Test' }] } };
      mockDocClient.send.mockResolvedValue(mockResponse);

      const result = await executeDynamoOperation(mockDocClient, 'BatchGetItem', {
        RequestItems: {
          'test-table': {
            Keys: [{ id: { S: '123' } }]
          }
        }
      });

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            RequestItems: {
              'test-table': {
                Keys: [{ id: { S: '123' } }]
              }
            }
          }
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should execute BatchPutItem operation', async () => {
      const mockResponse = { };
      mockDocClient.send.mockResolvedValue(mockResponse);

      const result = await executeDynamoOperation(mockDocClient, 'BatchPutItem', {
        RequestItems: {
          'test-table': [
            {
              PutRequest: {
                Item: { id: '123', name: 'Test' }
              }
            }
          ]
        }
      });

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            RequestItems: {
              'test-table': [
                {
                  PutRequest: {
                    Item: { id: '123', name: 'Test' }
                  }
                }
              ]
            }
          }
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should execute BatchDeleteItem operation', async () => {
      const mockResponse = { };
      mockDocClient.send.mockResolvedValue(mockResponse);

      const result = await executeDynamoOperation(mockDocClient, 'BatchDeleteItem', {
        RequestItems: {
          'test-table': [
            {
              DeleteRequest: {
                Key: { id: { S: '123' } }
              }
            }
          ]
        }
      });

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            RequestItems: {
              'test-table': [
                {
                  DeleteRequest: {
                    Key: { id: { S: '123' } }
                  }
                }
              ]
            }
          }
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should execute TransactGetItems operation', async () => {
      const mockResponse = { Responses: [{ Item: { id: '123', name: 'Test' } }] };
      mockDocClient.send.mockResolvedValue(mockResponse);

      const result = await executeDynamoOperation(mockDocClient, 'TransactGetItems', {
        TransactItems: [
          {
            Get: {
              TableName: 'test-table',
              Key: { id: { S: '123' } }
            }
          }
        ]
      });

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TransactItems: [
              {
                Get: {
                  TableName: 'test-table',
                  Key: { id: { S: '123' } }
                }
              }
            ]
          }
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should execute TransactWriteItems operation', async () => {
      const mockResponse = { };
      mockDocClient.send.mockResolvedValue(mockResponse);

      const result = await executeDynamoOperation(mockDocClient, 'TransactWriteItems', {
        TransactItems: [
          {
            Put: {
              TableName: 'test-table',
              Item: { id: '123', name: 'Test' }
            }
          }
        ]
      });

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TransactItems: [
              {
                Put: {
                  TableName: 'test-table',
                  Item: { id: '123', name: 'Test' }
                }
              }
            ]
          }
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should execute Sync operation with ConsistentRead', async () => {
      const mockResponse = { Items: [{ id: '123', name: 'Test' }] };
      mockDocClient.send.mockResolvedValue(mockResponse);

      const result = await executeDynamoOperation(mockDocClient, 'Sync', {
        TableName: 'test-table',
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': { S: '123' } }
      });

      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: 'test-table',
            KeyConditionExpression: 'id = :id',
            ExpressionAttributeValues: { ':id': { S: '123' } },
            ConsistentRead: true
          }
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error for unsupported operation', async () => {
      await expect(
        executeDynamoOperation(mockDocClient, 'UnsupportedOperation', {})
      ).rejects.toThrow('Unsupported Dynamo operation: UnsupportedOperation');
    });

    it('should handle DynamoDB errors', async () => {
      const error = new Error('DynamoDB error');
      mockDocClient.send.mockRejectedValue(error);

      await expect(
        executeDynamoOperation(mockDocClient, 'GetItem', {})
      ).rejects.toThrow('DynamoDB error');
    });
  });
}); 