// Create a new user using put() from @aws-appsync/utils/dynamodb
import { util } from '@aws-appsync/utils';
import { put } from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const id = util.autoId();
  const now = util.time.nowISO8601();

  // Store the created item in stash for the response handler
  ctx.stash.createdUser = {
    id,
    name: ctx.arguments.input.name,
    email: ctx.arguments.input.email,
    createdAt: now,
  };

  return put({
    key: { id },
    item: {
      name: ctx.arguments.input.name,
      email: ctx.arguments.input.email,
      createdAt: now,
    },
  });
}

export function response(ctx) {
  // PutItem doesn't return the item, so we return from stash
  return ctx.stash.createdUser;
}
