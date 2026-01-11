// Query.getProject resolver
// Returns a project - the tasks field has its own resolver

export function request(ctx) {
  return {
    operation: 'GetItem',
    params: {
      key: { id: ctx.arguments.id }
    }
  };
}

export function response(ctx) {
  // Mock projects
  const projects = {
    'project-1': {
      id: 'project-1',
      name: 'Website Redesign',
      taskIds: ['task-1', 'task-2']
    },
    'project-2': {
      id: 'project-2',
      name: 'API Documentation',
      taskIds: ['task-3']
    }
  };

  const project = projects[ctx.arguments.id];
  if (!project) {
    return null;
  }

  // Return project - the tasks field has its own resolver
  // that will use ctx.source.taskIds to fetch related tasks
  return project;
}
