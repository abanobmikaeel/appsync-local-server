// Example: Using @aws-appsync/utils/dynamodb update helper with operations
// This shows how to use update builders for partial updates

import { util } from '@aws-appsync/utils';
import { update, operations } from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { id } = ctx.arguments;
  const { name, email } = ctx.arguments.input;
  const now = util.time.nowISO8601();

  // Build update operations dynamically based on provided fields
  const updateOps = [];

  if (name !== undefined) {
    updateOps.push(operations.replace('name', name));
  }

  if (email !== undefined) {
    updateOps.push(operations.replace('email', email));
  }

  // Always set updatedAt
  updateOps.push(operations.replace('updatedAt', now));

  // Build an update request using the helper
  const updateRequest = update({
    key: { id },
    update: updateOps
  });

  console.log('DynamoDB update request:', JSON.stringify(updateRequest));

  // Store expected result in stash
  ctx.stash.updatedUser = { id, name, email, updatedAt: now };

  return updateRequest;
}

export function response(ctx) {
  // For NONE data source, return the expected updated user
  return {
    id: ctx.arguments.id,
    name: ctx.arguments.input.name || 'Existing Name',
    email: ctx.arguments.input.email || 'existing@example.com',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: ctx.stash.updatedUser?.updatedAt || util.time.nowISO8601()
  };
}
