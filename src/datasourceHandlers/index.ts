import type {
  DataSource,
  DynamoDataSource,
  DynamoOperation,
  HTTPDataSource,
  HTTPRequest,
  LambdaDataSource,
  LambdaRequest,
  RDSDataSource,
  RDSRequest,
} from '../types/index.js';
import { executeDynamoOperation, getDynamoClient } from './dynamo.js';
import { executeHTTPOperation } from './http.js';
import { executeLambdaOperation } from './lambda.js';
import { executeRDSOperation } from './rds.js';

// Types for AppSync expression objects
interface ExpressionInput {
  expression: string;
  expressionNames?: Record<string, string>;
  expressionValues?: Record<string, unknown>;
}

/** Apply condition expression to params, merging with existing expression attributes */
function applyCondition(params: Record<string, unknown>, condition: ExpressionInput): void {
  params.ConditionExpression = condition.expression;
  if (condition.expressionNames) {
    params.ExpressionAttributeNames = { ...(params.ExpressionAttributeNames as object), ...condition.expressionNames };
  }
  if (condition.expressionValues) {
    params.ExpressionAttributeValues = {
      ...(params.ExpressionAttributeValues as object),
      ...condition.expressionValues,
    };
  }
}

/** Apply filter expression to params, merging with existing expression attributes */
function applyFilter(params: Record<string, unknown>, filter: ExpressionInput): void {
  params.FilterExpression = filter.expression;
  if (filter.expressionNames) {
    params.ExpressionAttributeNames = { ...(params.ExpressionAttributeNames as object), ...filter.expressionNames };
  }
  if (filter.expressionValues) {
    params.ExpressionAttributeValues = { ...(params.ExpressionAttributeValues as object), ...filter.expressionValues };
  }
}

/** Parse nextToken from base64 to ExclusiveStartKey */
function parseNextToken(nextToken: string): unknown {
  return JSON.parse(Buffer.from(nextToken, 'base64').toString());
}

/** Apply common scan/query options to params */
function applyScanQueryOptions(params: Record<string, unknown>, request: Record<string, unknown>): void {
  if (request.index) params.IndexName = request.index;
  if (request.limit) params.Limit = request.limit;
  if (request.nextToken) params.ExclusiveStartKey = parseNextToken(request.nextToken as string);
  if (request.consistentRead !== undefined) params.ConsistentRead = request.consistentRead;
  if (request.select) params.Select = request.select;
  if (request.filter) applyFilter(params, request.filter as ExpressionInput);
}

/** Transform GetItem request */
function transformGetItem(params: Record<string, unknown>, request: Record<string, unknown>): void {
  if (request.key) params.Key = request.key;
  if (request.consistentRead !== undefined) params.ConsistentRead = request.consistentRead;
  if (request.projection) {
    const proj = request.projection as string[];
    params.ProjectionExpression = proj.map((_, i) => `#p${i}`).join(', ');
    params.ExpressionAttributeNames = Object.fromEntries(proj.map((p, i) => [`#p${i}`, p]));
  }
}

/** Transform PutItem request */
function transformPutItem(params: Record<string, unknown>, request: Record<string, unknown>): void {
  params.Item = { ...(request.key as object), ...(request.attributeValues as object) };
  if (request.condition) applyCondition(params, request.condition as ExpressionInput);
}

/** Transform UpdateItem request */
function transformUpdateItem(params: Record<string, unknown>, request: Record<string, unknown>): void {
  if (request.key) params.Key = request.key;
  if (request.update) {
    const upd = request.update as ExpressionInput;
    params.UpdateExpression = upd.expression;
    if (upd.expressionNames) params.ExpressionAttributeNames = upd.expressionNames;
    if (upd.expressionValues) params.ExpressionAttributeValues = upd.expressionValues;
  }
  if (request.condition) applyCondition(params, request.condition as ExpressionInput);
  params.ReturnValues = 'ALL_NEW';
}

/** Transform DeleteItem request */
function transformDeleteItem(params: Record<string, unknown>, request: Record<string, unknown>): void {
  if (request.key) params.Key = request.key;
  if (request.condition) applyCondition(params, request.condition as ExpressionInput);
}

/** Transform Query request */
function transformQuery(params: Record<string, unknown>, request: Record<string, unknown>): void {
  if (request.query) {
    const q = request.query as ExpressionInput;
    params.KeyConditionExpression = q.expression;
    if (q.expressionNames) params.ExpressionAttributeNames = q.expressionNames;
    if (q.expressionValues) params.ExpressionAttributeValues = q.expressionValues;
  }
  applyScanQueryOptions(params, request);
  if (request.scanIndexForward !== undefined) params.ScanIndexForward = request.scanIndexForward;
}

/** Transform Scan request */
function transformScan(params: Record<string, unknown>, request: Record<string, unknown>): void {
  applyScanQueryOptions(params, request);
  if (request.totalSegments !== undefined) params.TotalSegments = request.totalSegments;
  if (request.segment !== undefined) params.Segment = request.segment;
}

/** Transform batch/transact operations */
function transformBatchTransact(params: Record<string, unknown>, request: Record<string, unknown>): void {
  delete params.TableName; // Not used at top level for batch/transact
  if (request.tables) params.RequestItems = request.tables;
  if (request.transactItems) params.TransactItems = request.transactItems;
}

/** Transform Sync request */
function transformSync(params: Record<string, unknown>, request: Record<string, unknown>): void {
  if (request.filter) applyFilter(params, request.filter as ExpressionInput);
  if (request.limit) params.Limit = request.limit;
  if (request.nextToken) params.ExclusiveStartKey = parseNextToken(request.nextToken as string);
}

/**
 * Transform AppSync-style DynamoDB request to AWS SDK format
 * AppSync uses camelCase, SDK uses PascalCase
 */
function transformDynamoRequest(
  request: Record<string, unknown>,
  tableName: string
): { operation: DynamoOperation; params: Record<string, unknown> } {
  const operation = request.operation as DynamoOperation;
  const params: Record<string, unknown> = { TableName: tableName };

  const transformers: Record<string, (p: Record<string, unknown>, r: Record<string, unknown>) => void> = {
    GetItem: transformGetItem,
    PutItem: transformPutItem,
    UpdateItem: transformUpdateItem,
    DeleteItem: transformDeleteItem,
    Query: transformQuery,
    Scan: transformScan,
    BatchGetItem: transformBatchTransact,
    BatchPutItem: transformBatchTransact,
    BatchDeleteItem: transformBatchTransact,
    TransactGetItems: transformBatchTransact,
    TransactWriteItems: transformBatchTransact,
    Sync: transformSync,
  };

  const transformer = transformers[operation];
  if (transformer) {
    transformer(params, request);
  }

  return { operation, params };
}

/** Handle data source execution */
export async function executeDataSource(
  dataSourceName: string,
  dataSources: DataSource[],
  request: unknown
): Promise<unknown> {
  // Find the data source configuration
  const dataSource = dataSources.find((ds) => ds.name === dataSourceName);
  if (!dataSource) {
    throw new Error(`Data source '${dataSourceName}' not found`);
  }

  switch (dataSource.type) {
    case 'DYNAMODB': {
      const dynamoDS = dataSource as DynamoDataSource;
      const { operation, params } = transformDynamoRequest(
        request as Record<string, unknown>,
        dynamoDS.config.tableName
      );
      const docClient = getDynamoClient(dynamoDS);
      return executeDynamoOperation(docClient, operation, params);
    }

    case 'LAMBDA':
      return executeLambdaOperation(dataSource as LambdaDataSource, request as LambdaRequest);

    case 'HTTP':
      return executeHTTPOperation(dataSource as HTTPDataSource, request as HTTPRequest);

    case 'RDS':
      return executeRDSOperation(dataSource as RDSDataSource, request as RDSRequest);

    case 'NONE':
      return request; // For NONE data sources, just return the request as-is

    default:
      throw new Error(`Unsupported data source type: ${(dataSource as DataSource).type}`);
  }
}

// Re-export individual handlers for direct use
export { executeDynamoOperation } from './dynamo.js';
export { executeHTTPOperation, httpRequest, isSuccessResponse } from './http.js';
export { executeLambdaOperation } from './lambda.js';
export { closeAllPools, executeRDSOperation, rdsRequest } from './rds.js';
