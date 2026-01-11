// Delete user resolver
const users = {
  '1': { id: '1', name: 'Alice', email: 'alice@example.com', createdAt: '2024-01-01T00:00:00Z' },
  '2': { id: '2', name: 'Bob', email: 'bob@example.com', createdAt: '2024-01-02T00:00:00Z' },
};

export function request(ctx) {
  return { id: ctx.arguments.id };
}

export function response(ctx) {
  const id = ctx.prev.result.id;
  return users[id] !== undefined;
}
