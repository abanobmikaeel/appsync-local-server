/**
 * Returns the current user's identity from ctx.identity
 * This demonstrates AWS_LAMBDA mock identity feature
 */
export function request(ctx) {
  return {
    sub: ctx.identity?.sub,
    username: ctx.identity?.username,
    groups: ctx.identity?.groups,
    resolverContext: ctx.identity?.resolverContext,
  };
}

export function response(ctx) {
  return ctx.prev.result;
}
