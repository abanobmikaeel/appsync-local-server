// Example: Using @aws-appsync/utils/dynamodb scan helper
// This shows how DynamoDB helpers would be used (even with NONE data source)

import { scan } from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  // Build a scan request using the helper
  const scanRequest = scan({
    limit: ctx.arguments.limit || 10
  });

  // Log what would be sent to DynamoDB
  console.log('DynamoDB scan request:', JSON.stringify(scanRequest));

  return scanRequest;
}

export function response(ctx) {
  // For NONE data source, we return mock data
  return [
    { id: '1', name: 'Alice', email: 'alice@example.com', createdAt: '2024-01-01T00:00:00Z' },
    { id: '2', name: 'Bob', email: 'bob@example.com', createdAt: '2024-01-02T00:00:00Z' },
  ];
}
