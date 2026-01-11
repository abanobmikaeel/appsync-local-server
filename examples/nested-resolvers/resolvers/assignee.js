// Task.assignee field resolver
// Fetches the User assigned to this task using ctx.source.assigneeId
// This demonstrates nested object resolution

export function request(ctx) {
  // Get assigneeId from parent Task
  const assigneeId = ctx.source.assigneeId;

  if (!assigneeId) {
    ctx.stash.noAssignee = true;
    return {};
  }

  ctx.stash.assigneeId = assigneeId;

  // In a real app, this would query DynamoDB for the User
  return {
    operation: 'GetItem',
    params: {
      key: { id: assigneeId }
    }
  };
}

export function response(ctx) {
  if (ctx.stash.noAssignee) {
    return null;
  }

  // Mock user database
  const users = {
    'user-1': {
      id: 'user-1',
      name: 'Alice Johnson',
      email: 'alice@example.com',
      role: 'DEVELOPER'
    },
    'user-2': {
      id: 'user-2',
      name: 'Bob Smith',
      email: 'bob@example.com',
      role: 'DESIGNER'
    }
  };

  // Return User object - becomes ctx.source for User field resolvers
  return users[ctx.stash.assigneeId] || null;
}
