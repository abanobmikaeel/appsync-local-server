// List all users using scan() from @aws-appsync/utils/dynamodb
import { scan } from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  // This is the exact use case from the bug report - scan({}) with no params
  return scan({});
}

export function response(ctx) {
  return ctx.prev.result?.Items || [];
}
