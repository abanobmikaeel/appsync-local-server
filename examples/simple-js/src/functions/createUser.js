export async function request(ctx) {
  // This is where you process the incoming request
  // ctx contains: { arguments, stash, prev, util, env }
  
  // For Lambda data sources, we must return { operation: "Invoke", payload: ... }
  return {
    operation: "Invoke",
    payload: {
      name: ctx.arguments.name,
      email: ctx.arguments.email,
    }
  };
}

export async function response(ctx) {
  // This is where you format the response
  // ctx.prev.result contains the result from the Lambda function
  const lambdaResult = ctx.prev.result;
  
  // Return the processed user data from the Lambda
  return {
    id: lambdaResult.id || "1",
    name: lambdaResult.name,
    email: lambdaResult.email,
    createdAt: lambdaResult.createdAt,
    updatedAt: lambdaResult.updatedAt,
    processed: lambdaResult.processed || false,
    lambdaProcessed: lambdaResult.lambdaProcessed || false
  };
}