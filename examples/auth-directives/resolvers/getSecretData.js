export function request(ctx) {
  return {};
}

export function response(ctx) {
  // This data requires IAM auth due to the SecretData type's @aws_iam directive
  // Even though Query.getSecretData allows API_KEY, the return type blocks it
  return {
    secretId: 'secret-123',
    secretValue: 'TOP_SECRET_VALUE',
    classification: 'CLASSIFIED',
  };
}
