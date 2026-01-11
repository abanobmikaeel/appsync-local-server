// Mutation.createTask resolver
// Creates a new task - returned task will have nested fields resolved

export function request(ctx) {
  const input = ctx.arguments.input;
  const newId = ctx.util.autoId();

  ctx.stash.newTask = {
    id: newId,
    title: input.title,
    description: input.description || null,
    taskType: input.taskType,
    status: 'TODO',
    assigneeId: input.assigneeId || null,
    createdAt: ctx.util.time.nowISO8601()
  };

  return {
    operation: 'PutItem',
    params: {
      item: ctx.stash.newTask
    }
  };
}

export function response(ctx) {
  // Return the new task
  // Nested field resolvers (taskNumber, displayName, etc.) will be called
  return ctx.stash.newTask;
}
