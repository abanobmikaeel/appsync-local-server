/**
 * Demonstrates cache eviction on update
 */

const posts = {
  '1': { id: '1', title: 'First Post', content: 'Hello World', authorId: 'user1', status: 'PUBLISHED', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
};

export function request(ctx) {
  const { id, input } = ctx.arguments;

  ctx.stash.postId = id;
  ctx.stash.updates = input;

  return { operation: 'UpdateItem', key: { id }, updates: input };
}

export function response(ctx) {
  const postId = ctx.stash.postId;
  const updates = ctx.stash.updates;

  // Get existing post (in real app, this would be ctx.prev.result)
  const existingPost = posts[postId];
  if (!existingPost) {
    ctx.util.error(`Post ${postId} not found`, 'NotFound');
  }

  // Apply updates
  const updatedPost = {
    ...existingPost,
    ...updates,
    updatedAt: ctx.util.time.nowISO8601(),
  };

  // Evict cached post
  ctx.extensions.evictFromApiCache('Query', 'getPost', { id: postId });

  return updatedPost;
}
