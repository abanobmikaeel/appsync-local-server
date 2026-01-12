export function request(ctx) {
  return {};
}

export function response(ctx) {
  // In real app, would get user from ctx.identity
  const userId = ctx.identity?.sub || 'anonymous';
  return {
    id: userId,
    name: ctx.identity?.username || 'Current User',
    email: `${ctx.identity?.username || 'user'}@example.com`,
    role: 'user',
  };
}
