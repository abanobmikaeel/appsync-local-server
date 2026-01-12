export function request(ctx) {
  return { input: ctx.arguments.input };
}

export function response(ctx) {
  const userId = ctx.identity?.sub || 'user-1';
  return {
    id: userId,
    name: ctx.arguments.input.name || 'Updated User',
    email: ctx.arguments.input.email || 'updated@example.com',
    role: 'user',
  };
}
