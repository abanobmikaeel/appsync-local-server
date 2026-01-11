// Update user resolver
const users = {
  '1': { id: '1', name: 'Alice', email: 'alice@example.com', createdAt: '2024-01-01T00:00:00Z' },
  '2': { id: '2', name: 'Bob', email: 'bob@example.com', createdAt: '2024-01-02T00:00:00Z' },
};

export function request(ctx) {
  const { id, input } = ctx.arguments;
  return { id, input };
}

export function response(ctx) {
  const { id, input } = ctx.prev.result;
  const existing = users[id];

  if (!existing) {
    return null;
  }

  // Merge updates
  const updated = {
    ...existing,
    ...(input.name && { name: input.name }),
    ...(input.email && { email: input.email }),
  };

  return updated;
}
