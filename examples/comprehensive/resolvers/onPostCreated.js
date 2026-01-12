/**
 * Demonstrates subscription with extensions.setSubscriptionFilter()
 * Subscribers can filter to only receive posts from a specific author
 */

export function request(ctx) {
  // Subscription resolvers return null for the request
  return null;
}

export function response(ctx) {
  const { authorId } = ctx.arguments;

  // If subscriber specified an authorId filter, apply it
  if (authorId) {
    // Convert to subscription filter format
    const filter = ctx.util.transform.toSubscriptionFilter({
      authorId: authorId,
    });

    // Set the filter - only posts matching this filter will be sent
    ctx.extensions.setSubscriptionFilter(filter);

    console.log(`Subscription filter set for authorId: ${authorId}`);
  }

  // Return null for subscription setup
  return null;
}
