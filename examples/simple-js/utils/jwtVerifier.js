exports.handler = async (event) => {
  // Extract token from event if needed
  // const token = event.token;
  
  // For hello world testing - always return a valid user
  return {
    statusCode: 200,
    body: {
      isValid: true,
      userName: 'test-user',
      sub: '12345',
      groups: ['users'],
      // Adding some standard JWT claims
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour from now
    }
  };
};