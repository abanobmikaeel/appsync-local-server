// Test resolver that uses imports from @aws-appsync/utils/dynamodb
// This should work locally thanks to the loader hooks

import { get } from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  // Use the get helper from dynamodb
  return get({ key: { id: ctx.arguments.id } });
}

export function response(ctx) {
  // In real DynamoDB, ctx.prev.result would be the item
  // For NONE datasource, we just return mock data
  return {
    id: ctx.arguments.id,
    name: 'DynamoDB User',
    createdAt: '2024-01-01T00:00:00Z'
  };
}
