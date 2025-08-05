/**
 * Sample Lambda function for createUser data source
 * This function simulates a Lambda that processes user creation
 */

export async function handler(ctx) {
  // Extract the payload from the AppSync invoke request
  const payload = ctx.arguments || {};
  
  // The payload contains name and email directly
  const { name, email } = payload;
  
  // Simulate some processing
  const processedUser = {
    id: `user_${Date.now()}`,
    name: name,
    email: email,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    processed: true,
    lambdaProcessed: true
  };
  
  // Return the processed user data
  return processedUser;
}

// Alternative export for compatibility
export default handler;