/**
 * Simple unit resolver demonstrating basic context usage
 */

// Mock database
const posts = {
  '1': { id: '1', title: 'First Post', content: 'Hello World', authorId: 'user1', status: 'PUBLISHED', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  '2': { id: '2', title: 'Draft Post', content: 'Work in progress', authorId: 'user2', status: 'DRAFT', createdAt: '2024-01-02', updatedAt: '2024-01-02' },
};

export function request(ctx) {
  // Access arguments
  const { id } = ctx.arguments;

  // Store in stash for response handler
  ctx.stash.requestedId = id;
  ctx.stash.requestTime = ctx.util.time.nowISO8601();

  return { id };
}

export function response(ctx) {
  const id = ctx.stash.requestedId;
  const post = posts[id];

  if (!post) {
    ctx.util.appendError(`Post with id ${id} not found`, 'NotFound');
    return null;
  }

  return post;
}
