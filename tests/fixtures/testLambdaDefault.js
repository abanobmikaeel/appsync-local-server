// Test Lambda function with default export
export default async function(event) {
  return {
    success: true,
    type: 'default',
    received: event,
  };
}
