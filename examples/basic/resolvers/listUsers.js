// In-memory user store
const users = [
  { id: '1', name: 'Alice', email: 'alice@example.com', createdAt: '2024-01-01T00:00:00Z' },
  { id: '2', name: 'Bob', email: 'bob@example.com', createdAt: '2024-01-02T00:00:00Z' },
];

export function request(ctx) {
  return {};
}

export function response(ctx) {
  return users;
}
