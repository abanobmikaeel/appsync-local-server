// Test Lambda function for unit tests
export async function handler(event) {
  return {
    success: true,
    received: event,
  };
}
