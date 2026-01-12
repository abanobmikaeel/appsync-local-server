/**
 * Demonstrates subscription with setSubscriptionInvalidationFilter
 * This subscription will be invalidated when the post is deleted
 */

export function request(ctx) {
  return null;
}

export function response(ctx) {
  const { postId } = ctx.arguments;

  if (postId) {
    // Set filter for which updates to receive
    ctx.extensions.setSubscriptionFilter(
      ctx.util.transform.toSubscriptionFilter({ 'post.id': postId })
    );

    // Set invalidation filter - when deletePost sends invalidation
    // with matching postId, this subscription will be closed
    ctx.extensions.setSubscriptionInvalidationFilter(
      ctx.util.transform.toSubscriptionFilter({ postId: postId })
    );

    console.log(`Subscription set for postId: ${postId} with invalidation filter`);
  }

  return null;
}
