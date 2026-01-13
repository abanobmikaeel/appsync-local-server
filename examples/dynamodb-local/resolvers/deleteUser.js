// Delete a user using remove() from @aws-appsync/utils/dynamodb
import { remove } from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  return remove({
    key: { id: ctx.arguments.id },
  });
}

export function response(ctx) {
  return ctx.prev.result?.Attributes || { id: ctx.arguments.id };
}
