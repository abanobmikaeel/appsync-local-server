// Example: Using @aws-appsync/utils for ID generation and time utilities
// This shows how to use util helpers with DynamoDB put operation

import { util } from '@aws-appsync/utils';
import { put } from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const id = util.autoId(); // Generate a unique ID
  const now = util.time.nowISO8601(); // Current timestamp

  // Build a put request using the helper
  const putRequest = put({
    key: { id },
    item: {
      id,
      name: ctx.arguments.input.name,
      email: ctx.arguments.input.email,
      createdAt: now,
    }
  });

  // Store the created user in stash for response
  ctx.stash.createdUser = { id, ...ctx.arguments.input, createdAt: now };

  return putRequest;
}

export function response(ctx) {
  // Return the created user from stash
  return ctx.stash.createdUser;
}
