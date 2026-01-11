// Query.listTasks resolver
// Returns all tasks - each task will have its nested fields resolved

export function request(ctx) {
  return {
    operation: 'Scan'
  };
}

export function response(ctx) {
  // Mock all tasks
  return [
    {
      id: 'task-1',
      title: 'Fix login bug',
      description: 'Users cannot login with special characters',
      taskType: 'BUG',
      status: 'IN_PROGRESS',
      assigneeId: 'user-1'
    },
    {
      id: 'task-2',
      title: 'Add dark mode',
      description: 'Implement dark mode toggle',
      taskType: 'FEATURE',
      status: 'TODO',
      assigneeId: 'user-2'
    },
    {
      id: 'task-3',
      title: 'Update API docs',
      description: 'Document new endpoints',
      taskType: 'DOCUMENTATION',
      status: 'REVIEW',
      assigneeId: null
    }
  ];
}
