/**
 * Demonstrates runtime.earlyReturn()
 * Returns a default post if the requested one doesn't exist
 */

const posts = {
  '1': { id: '1', title: 'First Post', content: 'Hello World', authorId: 'user1', status: 'PUBLISHED', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
};

const DEFAULT_POST = {
  id: 'default',
  title: 'Default Post',
  content: 'This is a default post returned when the requested post is not found',
  authorId: 'system',
  status: 'PUBLISHED',
  createdAt: '2000-01-01',
  updatedAt: '2000-01-01',
};

export function request(ctx) {
  const { id } = ctx.arguments;
  const post = posts[id];

  // If post doesn't exist, use earlyReturn to skip data source and return default
  if (!post) {
    console.log(`Post ${id} not found, returning default via earlyReturn`);
    return ctx.runtime.earlyReturn(DEFAULT_POST);
  }

  return { id };
}

export function response(ctx) {
  // This will receive either:
  // 1. The earlyReturn data (DEFAULT_POST) if post wasn't found
  // 2. The data source result if post was found
  return ctx.prev.result || posts[ctx.arguments.id];
}
