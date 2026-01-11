import type {
  DataSource,
  DynamoDataSource,
  DynamoRequest,
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
      const { operation, params } = request as DynamoRequest;
      const docClient = getDynamoClient(dataSource as DynamoDataSource);
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
