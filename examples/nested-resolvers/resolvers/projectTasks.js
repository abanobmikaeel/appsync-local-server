// Project.tasks field resolver
// Fetches tasks that belong to this project
// Uses ctx.source to access parent Project data

export function request(ctx) {
  // Get taskIds from parent Project (ctx.source)
  const taskIds = ctx.source.taskIds || [];
  ctx.stash.taskIds = taskIds;

  // In a real app, this would be a BatchGetItem operation
  return {
    operation: 'BatchGetItem',
    params: {
      keys: taskIds.map(id => ({ id }))
    }
  };
}

export function response(ctx) {
  // Mock task lookup
  const allTasks = {
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

  // Return tasks for this project
  // Each task becomes ctx.source for the task field resolvers
  return ctx.stash.taskIds
    .map(id => allTasks[id])
    .filter(Boolean);
}
