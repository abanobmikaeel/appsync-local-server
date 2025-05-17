import { executeDynamoOperation } from './dynamo.js';

/** Handle data source execution */
export async function executeDataSource(docClient, dataSource, request) {
  if (dataSource === 'DYNAMODB') {
    const { operation, params } = request;
    return executeDynamoOperation(docClient, operation, params);
  }
  return request; // NONE or future sources
}