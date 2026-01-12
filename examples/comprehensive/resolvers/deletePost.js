/**
 * Demonstrates:
 * - extensions.invalidateSubscriptions() to close subscriptions
 * - extensions.evictFromApiCache() to clear cache
 */

export function request(ctx) {
  const { id } = ctx.arguments;

  ctx.stash.postId = id;

  return { operation: 'DeleteItem', key: { id } };
}

export function response(ctx) {
  const postId = ctx.stash.postId;

  // Invalidate any subscriptions watching this specific post
  ctx.extensions.invalidateSubscriptions({
    subscriptionField: 'onPostUpdated',
    payload: { postId: postId },
  });

  // Evict this post from cache
  ctx.extensions.evictFromApiCache('Query', 'getPost', { id: postId });

  // Evict list cache
  ctx.extensions.evictFromApiCache('Query', 'listPosts', {});

  console.log(`Deleted post ${postId}, invalidated subscriptions and cache`);

  return true;
}
