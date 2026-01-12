const users = {
  '1': { id: '1', name: 'Alice', email: 'alice@example.com', role: 'admin' },
  '2': { id: '2', name: 'Bob', email: 'bob@example.com', role: 'user' },
};

export function request(ctx) {
  return { id: ctx.arguments.id };
}

export function response(ctx) {
  return users[ctx.arguments.id] || null;
}
