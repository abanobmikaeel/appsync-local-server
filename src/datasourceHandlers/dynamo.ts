import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  type BatchGetCommandInput,
  BatchWriteCommand,
  type BatchWriteCommandInput,
  DeleteCommand,
  type DeleteCommandInput,
  DynamoDBDocumentClient,
  GetCommand,
  type GetCommandInput,
  PutCommand,
  type PutCommandInput,
  QueryCommand,
  type QueryCommandInput,
  ScanCommand,
  type ScanCommandInput,
  TransactGetCommand,
  type TransactGetCommandInput,
  TransactWriteCommand,
  type TransactWriteCommandInput,
  UpdateCommand,
  type UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb';
import type { DynamoDataSource, DynamoOperation } from '../types/index.js';

// Cache of DynamoDB clients by data source name
const clientCache = new Map<string, DynamoDBDocumentClient>();

/**
 * Create or retrieve a DynamoDB client for the given data source
 * Supports both local development (with endpoint) and real AWS (without endpoint)
 */
export function getDynamoClient(dataSource: DynamoDataSource): DynamoDBDocumentClient {
  const cacheKey = dataSource.name;

  if (!clientCache.has(cacheKey)) {
    const { region, endpoint, accessKeyId, secretAccessKey } = dataSource.config;

    const clientConfig: ConstructorParameters<typeof DynamoDBClient>[0] = {
      region,
    };

    // Use endpoint if provided (for local DynamoDB)
    if (endpoint) {
      clientConfig.endpoint = endpoint;
    }

    // Use explicit credentials if provided, otherwise SDK uses default credential chain
    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    const ddbClient = new DynamoDBClient(clientConfig);
    const docClient = DynamoDBDocumentClient.from(ddbClient, {
      marshallOptions: { removeUndefinedValues: true },
    });

    clientCache.set(cacheKey, docClient);
  }

  return clientCache.get(cacheKey)!;
}

/** Handle DynamoDB operations */
export async function executeDynamoOperation(
  docClient: DynamoDBDocumentClient,
  operation: DynamoOperation,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (operation) {
    // Single-item operations
    case 'GetItem':
      return docClient.send(new GetCommand(params as GetCommandInput));
    case 'PutItem':
      return docClient.send(new PutCommand(params as PutCommandInput));
    case 'UpdateItem':
      return docClient.send(new UpdateCommand(params as UpdateCommandInput));
    case 'DeleteItem':
      return docClient.send(new DeleteCommand(params as DeleteCommandInput));

    // Query and Scan operations
    case 'Query':
      return docClient.send(new QueryCommand(params as QueryCommandInput));
    case 'Scan':
      return docClient.send(new ScanCommand(params as ScanCommandInput));

    // Batch operations
    case 'BatchGetItem':
      return docClient.send(new BatchGetCommand(params as BatchGetCommandInput));
    case 'BatchPutItem':
      return docClient.send(new BatchWriteCommand(params as BatchWriteCommandInput));
    case 'BatchDeleteItem':
      return docClient.send(new BatchWriteCommand(params as BatchWriteCommandInput));

    // Transaction operations
    case 'TransactGetItems':
      return docClient.send(new TransactGetCommand(params as TransactGetCommandInput));
    case 'TransactWriteItems':
      return docClient.send(new TransactWriteCommand(params as TransactWriteCommandInput));

    // Sync is handled through other operations, typically Query with specific parameters
    case 'Sync': {
      const queryParams = params as QueryCommandInput;
      return docClient.send(
        new QueryCommand({
          ...queryParams,
          ConsistentRead: true,
        })
      );
    }

    default:
      throw new Error(`Unsupported Dynamo operation: ${operation}`);
  }
}
