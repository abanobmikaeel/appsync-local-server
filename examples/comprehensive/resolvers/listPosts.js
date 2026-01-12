/**
 * Demonstrates util.transform.toDynamoDBFilterExpression()
 * Shows how to convert filter input to DynamoDB expressions
 */

const posts = [
  { id: '1', title: 'First Post', content: 'Hello World', authorId: 'user1', status: 'PUBLISHED', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: '2', title: 'Draft Post', content: 'Work in progress', authorId: 'user2', status: 'DRAFT', createdAt: '2024-01-02', updatedAt: '2024-01-02' },
  { id: '3', title: 'Another Published', content: 'More content', authorId: 'user1', status: 'PUBLISHED', createdAt: '2024-01-03', updatedAt: '2024-01-03' },
];

export function request(ctx) {
  const { filter, limit } = ctx.arguments;

  // If filter is provided, convert to DynamoDB expression format
  // This demonstrates the transform utility
  if (filter) {
    const dynamoFilter = {};

    if (filter.status) {
      dynamoFilter.status = { eq: filter.status };
    }
    if (filter.authorId) {
      dynamoFilter.authorId = { eq: filter.authorId };
    }

    // Generate DynamoDB filter expression
    const expression = ctx.util.transform.toDynamoDBFilterExpression(dynamoFilter);

    // Log for demonstration
    console.log('Generated DynamoDB expression:', JSON.stringify(expression, null, 2));

    ctx.stash.filterExpression = expression;
  }

  ctx.stash.limit = limit || 10;

  return { operation: 'scan' };
}

export function response(ctx) {
  // In real usage, ctx.prev.result would have DynamoDB results
  // For this demo, we filter in-memory
  let results = [...posts];

  const filter = ctx.arguments.filter;
  if (filter) {
    if (filter.status) {
      results = results.filter(p => p.status === filter.status);
    }
    if (filter.authorId) {
      results = results.filter(p => p.authorId === filter.authorId);
    }
  }

  return results.slice(0, ctx.stash.limit);
}
