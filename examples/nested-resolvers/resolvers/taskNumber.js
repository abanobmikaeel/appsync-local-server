// Task.taskNumber field resolver
// Demonstrates using ctx.source to access parent Task data
//
// When a query requests task.taskNumber, Apollo first resolves the Task,
// then calls this resolver with the Task as ctx.source

export function request(ctx) {
  // ctx.source contains the parent Task object from getTask resolver
  // We can access taskType here to compute the task number

  const taskType = ctx.source.taskType;
  const id = ctx.source.id;

  // Store data in stash for response
  ctx.stash.taskType = taskType;
  ctx.stash.id = id;

  // No data source operation needed - pure computation
  return {};
}

export function response(ctx) {
  // Compute taskNumber based on taskType
  // Format: TYPE-### (e.g., BUG-001, FEAT-002)
  const prefixes = {
    'BUG': 'BUG',
    'FEATURE': 'FEAT',
    'ENHANCEMENT': 'ENH',
    'DOCUMENTATION': 'DOC'
  };

  const prefix = prefixes[ctx.stash.taskType] || 'TASK';
  const numericId = ctx.stash.id.replace(/\D/g, '').padStart(3, '0');

  return `${prefix}-${numericId}`;
}
