import { executeDynamoOperation } from './dynamo.js';
import { executeLambdaOperation } from './lambda.js';

/** Handle data source execution */
export async function executeDataSource(docClient, dataSourceName, dataSources, request) {
  // Find the data source configuration
  const dataSource = dataSources.find(ds => ds.name === dataSourceName);
  if (!dataSource) {
    throw new Error(`Data source '${dataSourceName}' not found`);
  }

  switch (dataSource.type) {
    case 'DYNAMODB':
      const { operation, params } = request;
      return executeDynamoOperation(docClient, operation, params);
    
    case 'LAMBDA':
      return executeLambdaOperation(dataSource, request);
    
    case 'NONE':
      return request; // For NONE data sources, just return the request as-is
    
    default:
      throw new Error(`Unsupported data source type: ${dataSource.type}`);
  }
}