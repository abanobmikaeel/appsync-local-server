export async function request(ctx) {
  // This is where you process the incoming request
  // ctx contains: { arguments, stash, prev, util, env }
  return "Hello from request!";
}

export async function response(ctx) {
  // This is where you format the response
  // ctx.prev.result contains the result from request()
  return ctx.prev.result;
}