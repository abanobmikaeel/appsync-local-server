// Get a single user by ID using @aws-appsync/utils/dynamodb
import { get } from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  return get({
    key: { id: ctx.arguments.id },
  });
}

export function response(ctx) {
  return ctx.prev.result?.Item || null;
}
