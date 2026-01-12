/**
 * Demonstrates:
 * - extensions.evictFromApiCache() for cache invalidation
 * - util.autoId() for ID generation
 * - util.time for timestamps
 */

export function request(ctx) {
  const { input } = ctx.arguments;
  const identity = ctx.identity;

  // Generate new post with auto-generated ID
  const newPost = {
    id: ctx.util.autoId(),
    title: input.title,
    content: input.content,
    authorId: identity?.sub || 'anonymous',
    status: input.status || 'DRAFT',
    createdAt: ctx.util.time.nowISO8601(),
    updatedAt: ctx.util.time.nowISO8601(),
  };

  // Store for response handler
  ctx.stash.newPost = newPost;

  return { operation: 'PutItem', params: newPost };
}

export function response(ctx) {
  const newPost = ctx.stash.newPost;

  // Evict listPosts cache since we added a new post
  ctx.extensions.evictFromApiCache('Query', 'listPosts', {});

  // Also evict any cached posts by this author
  ctx.extensions.evictFromApiCache('Query', 'listPosts', {
    authorId: newPost.authorId,
  });

  console.log(`Created post ${newPost.id}, evicted cache`);

  return newPost;
}
