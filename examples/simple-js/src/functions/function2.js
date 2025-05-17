export async function request(ctx) {
  // Extract arguments from the context
  const { arguments: args } = ctx;

  // Construct the DynamoDB request
  const ddbRequest = {
    operation: 'GetItem', // or PutItem, Query, etc.
    key: {
      id: { S: args.id } // Assuming 'id' is passed as an argument
    },
    tableName: 'test'
  };

  // Return the formatted DynamoDB request
  return ddbRequest;
}

export async function response(ctx) {
  // Get the DynamoDB response from the previous function
  const result = ctx.prev.result;

  // If no item found, return null
  if (!result || !result.Item) {
    return null;
  }

  // Transform DynamoDB response to desired format
  // This example assumes we're getting an item with id and name attributes
  return {
    id: result.Item.id.S,
    name: result.Item.name?.S
  };
}