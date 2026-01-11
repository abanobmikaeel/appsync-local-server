// User.displayRole field resolver
// Demonstrates deep nesting: Query -> Task -> User -> displayRole
// ctx.source here is the User object from assignee resolver

export function request(ctx) {
  // Access User fields from ctx.source
  ctx.stash.name = ctx.source.name;
  ctx.stash.role = ctx.source.role;
  return {};
}

export function response(ctx) {
  // Format role with name
  const roleLabels = {
    'DEVELOPER': 'Software Developer',
    'DESIGNER': 'UX Designer',
    'MANAGER': 'Project Manager',
    'QA': 'QA Engineer'
  };

  const roleLabel = roleLabels[ctx.stash.role] || ctx.stash.role;
  return `${ctx.stash.name} (${roleLabel})`;
}
