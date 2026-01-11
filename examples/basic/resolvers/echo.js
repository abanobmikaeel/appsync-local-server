// Simple echo resolver - demonstrates basic request/response pattern
export function request(ctx) {
  return {
    message: ctx.arguments.message,
  };
}

export function response(ctx) {
  return ctx.prev.result.message;
}
