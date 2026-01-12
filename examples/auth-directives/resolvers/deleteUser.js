export function request(ctx) {
  return { id: ctx.arguments.id };
}

export function response(ctx) {
  // Only admins should reach here (enforced by directive)
  return true;
}
