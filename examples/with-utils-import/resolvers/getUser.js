// Test resolver that uses imports from @aws-appsync/utils
// This should work locally thanks to the loader hooks

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  // Use util from the import
  const id = ctx.arguments.id || util.autoId();
  return { id };
}

export function response(ctx) {
  return {
    id: ctx.prev.result.id,
    name: 'Test User',
    createdAt: util.time.nowISO8601()
  };
}
