export async function request(ctx) {
  // This is a simple test unit resolver
  // ctx contains: { arguments, stash, prev, util, env }
  
  // For NONE data sources, we can return any data we want
  return {
    message: "Hello from testUnit!",
    timestamp: new Date().toISOString(),
    arguments: ctx.arguments,
    testData: {
      id: "test_123",
      name: "Test Unit Resolver",
      status: "active"
    }
  };
}

export async function response(ctx) {
  // This is where you format the response
  // ctx.prev.result contains the result from request()
  const result = ctx.prev.result;
  
  // Return a formatted response
  return {
    message: result.message,
    timestamp: result.timestamp,
    data: result.testData,
    receivedArguments: result.arguments
  };
} 