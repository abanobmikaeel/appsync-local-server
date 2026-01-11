// Task.priority field resolver
// Computes priority based on taskType and status from ctx.source

export function request(ctx) {
  ctx.stash.taskType = ctx.source.taskType;
  ctx.stash.status = ctx.source.status;
  return {};
}

export function response(ctx) {
  // Priority calculation:
  // - Base priority by type: BUG=10, FEATURE=5, ENHANCEMENT=3, DOC=1
  // - Boost for IN_PROGRESS (+5)
  // - Boost for REVIEW (+3)

  const basePriority = {
    'BUG': 10,
    'FEATURE': 5,
    'ENHANCEMENT': 3,
    'DOCUMENTATION': 1
  };

  const statusBoost = {
    'TODO': 0,
    'IN_PROGRESS': 5,
    'REVIEW': 3,
    'DONE': 0
  };

  const base = basePriority[ctx.stash.taskType] || 1;
  const boost = statusBoost[ctx.stash.status] || 0;

  return base + boost;
}
