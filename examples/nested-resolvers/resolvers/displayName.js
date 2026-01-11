// Task.displayName field resolver
// Another example of using ctx.source to access parent data

export function request(ctx) {
  // Access parent Task fields from ctx.source
  ctx.stash.title = ctx.source.title;
  ctx.stash.status = ctx.source.status;

  return {};
}

export function response(ctx) {
  // Format: [STATUS] Title
  const statusEmojis = {
    'TODO': '📋',
    'IN_PROGRESS': '🔄',
    'REVIEW': '👀',
    'DONE': '✅'
  };

  const emoji = statusEmojis[ctx.stash.status] || '•';
  return `${emoji} ${ctx.stash.title}`;
}
