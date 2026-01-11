// Create user resolver
export function request(ctx) {
  const input = ctx.arguments.input;
  const id = ctx.util.autoId();
  const createdAt = ctx.util.time.nowISO8601();

  return {
    user: {
      id,
      name: input.name,
      email: input.email,
      createdAt,
    },
  };
}

export function response(ctx) {
  return ctx.prev.result.user;
}
