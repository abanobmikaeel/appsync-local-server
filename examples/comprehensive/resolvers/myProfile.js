/**
 * Demonstrates accessing identity context from JWT/auth
 */

const users = {
  'user1': { id: 'user1', username: 'john', email: 'john@example.com' },
  'user2': { id: 'user2', username: 'jane', email: 'jane@example.com' },
};

export function request(ctx) {
  // Get user ID from identity (set by auth)
  const userId = ctx.identity?.sub;

  if (!userId) {
    ctx.util.unauthorized();
  }

  ctx.stash.userId = userId;

  return { userId };
}

export function response(ctx) {
  const userId = ctx.stash.userId;
  const user = users[userId];

  if (!user) {
    ctx.util.appendError('User profile not found', 'NotFound');
    return null;
  }

  return user;
}
