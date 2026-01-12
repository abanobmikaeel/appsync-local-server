/**
 * Echo resolver that also demonstrates access to identity and resolverContext
 */
export function request(ctx) {
  return {
    message: ctx.arguments.message,
    userId: ctx.identity?.sub,
    tenantId: ctx.identity?.resolverContext?.tenantId,
  };
}

export function response(ctx) {
  return ctx.prev.result;
}
