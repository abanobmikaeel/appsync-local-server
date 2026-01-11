// Query.getTask resolver
// Returns the basic task data - nested field resolvers handle computed fields

export function request(ctx) {
  // In a real app, this would query DynamoDB
  // For demo, we return mock data
  return {
    operation: 'GetItem',
    params: {
      key: { id: ctx.arguments.id }
    }
  };
}

export function response(ctx) {
  // Mock database response
  const tasks = {
    'task-1': {
      id: 'task-1',
      title: 'Fix login bug',
      description: 'Users cannot login with special characters',
      taskType: 'BUG',
      status: 'IN_PROGRESS',
      assigneeId: 'user-1'
    },
    'task-2': {
      id: 'task-2',
      title: 'Add dark mode',
      description: 'Implement dark mode toggle',
      taskType: 'FEATURE',
      status: 'TODO',
      assigneeId: 'user-2'
    },
    'task-3': {
      id: 'task-3',
      title: 'Update API docs',
      description: 'Document new endpoints',
      taskType: 'DOCUMENTATION',
      status: 'REVIEW',
      assigneeId: null
    }
  };

  const task = tasks[ctx.arguments.id];
  if (!task) {
    return null;
  }

  // Return the task - nested resolvers will compute additional fields
  // The task object becomes ctx.source for field resolvers
  return task;
}
