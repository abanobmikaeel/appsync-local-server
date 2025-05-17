import {
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
  TransactGetCommand,
  TransactWriteCommand
} from '@aws-sdk/lib-dynamodb';

/** Handle DynamoDB operations */
export async function executeDynamoOperation(docClient, operation, params) {
  switch (operation) {
    // Single-item operations
    case 'GetItem':    return docClient.send(new GetCommand(params));
    case 'PutItem':    return docClient.send(new PutCommand(params));
    case 'UpdateItem': return docClient.send(new UpdateCommand(params));
    case 'DeleteItem': return docClient.send(new DeleteCommand(params));
    
    // Query and Scan operations
    case 'Query': return docClient.send(new QueryCommand(params));
    case 'Scan':  return docClient.send(new ScanCommand(params));
    
    // Batch operations
    case 'BatchGetItem':    return docClient.send(new BatchGetCommand(params));
    case 'BatchPutItem':    return docClient.send(new BatchWriteCommand(params));
    case 'BatchDeleteItem': return docClient.send(new BatchWriteCommand(params));
    
    // Transaction operations
    case 'TransactGetItems':   return docClient.send(new TransactGetCommand(params));
    case 'TransactWriteItems': return docClient.send(new TransactWriteCommand(params));
    
    // Sync is handled through other operations, typically Query with specific parameters
    case 'Sync': return docClient.send(new QueryCommand({
      ...params,
      ConsistentRead: true
    }));

    default: throw new Error(`Unsupported Dynamo operation: ${operation}`);
  }
}
