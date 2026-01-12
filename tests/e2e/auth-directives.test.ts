import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type ChildProcess, spawn } from 'child_process';
import path from 'path';

// Use process.cwd() as project root since ts-jest doesn't support import.meta.url
const projectRoot = process.cwd();

const PORT = 4002;
const GRAPHQL_URL = `http://localhost:${PORT}/`;
const API_KEY = 'test-api-key';

// Helper to create a fake JWT token with claims
function createFakeJWT(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = 'fake-signature';
  return `${header}.${payload}.${signature}`;
}

// Helper to wait for server to be ready
async function waitForServer(url: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({ query: '{ __typename }' }),
      });
      if (response.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server not ready after ${maxAttempts} attempts`);
}

// Helper to execute GraphQL query with API key
async function graphqlWithApiKey<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<{ data?: T; errors?: Array<{ message: string; extensions?: Record<string, unknown> }> }> {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json() as Promise<{ data?: T; errors?: Array<{ message: string }> }>;
}

// Helper to execute GraphQL query with Cognito JWT
async function graphqlWithCognito<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  groups: string[] = []
): Promise<{ data?: T; errors?: Array<{ message: string; extensions?: Record<string, unknown> }> }> {
  const token = createFakeJWT({
    sub: 'user-123',
    iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxx',
    'cognito:username': 'testuser',
    'cognito:groups': groups,
  });

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json() as Promise<{ data?: T; errors?: Array<{ message: string }> }>;
}

// Helper to execute GraphQL query with IAM-style headers
async function graphqlWithIAM<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<{ data?: T; errors?: Array<{ message: string; extensions?: Record<string, unknown> }> }> {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/...',
      'x-amz-date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json() as Promise<{ data?: T; errors?: Array<{ message: string }> }>;
}

describe('E2E: Auth Directives', () => {
  let serverProcess: ChildProcess;

  beforeAll(async () => {
    const configPath = path.join(projectRoot, 'examples/auth-directives/appsync-config.json');

    // Start the server
    serverProcess = spawn('npx', ['tsx', 'bin/appsync-local.ts', 'start', '-c', configPath, '-p', String(PORT)], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout?.on('data', (data) => {
      console.log(`[server]: ${data}`);
    });
    serverProcess.stderr?.on('data', (data) => {
      console.error(`[server error]: ${data}`);
    });

    await waitForServer(GRAPHQL_URL);
  }, 30000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  describe('Type-level directive inheritance', () => {
    it('API key can access publicData (inherits @aws_api_key from Query type)', async () => {
      const result = await graphqlWithApiKey<{ publicData: string }>(`
        query {
          publicData
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data?.publicData).toContain('public data');
    });

    it('Cognito can access publicData (inherits @aws_cognito_user_pools from Query type)', async () => {
      const result = await graphqlWithCognito<{ publicData: string }>(`
        query {
          publicData
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data?.publicData).toContain('public data');
    });

    it('API key can access getUser (inherits from type)', async () => {
      const result = await graphqlWithApiKey<{ getUser: { id: string; name: string } }>(`
        query {
          getUser(id: "1") {
            id
            name
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data?.getUser?.id).toBe('1');
    });
  });

  describe('Field-level directive override', () => {
    it('API key CANNOT access myProfile (field has @aws_cognito_user_pools only)', async () => {
      const result = await graphqlWithApiKey(`
        query {
          myProfile {
            id
            name
          }
        }
      `);

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toContain('Not Authorized');
      expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHORIZED');
    });

    it('Cognito CAN access myProfile', async () => {
      const result = await graphqlWithCognito<{ myProfile: { id: string; name: string } }>(`
        query {
          myProfile {
            id
            name
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data?.myProfile).toBeDefined();
    });

    it('API key CANNOT access internalData (field requires @aws_iam)', async () => {
      const result = await graphqlWithApiKey(`
        query {
          internalData
        }
      `);

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toContain('Not Authorized');
    });

    it('IAM CAN access internalData', async () => {
      const result = await graphqlWithIAM<{ internalData: string }>(`
        query {
          internalData
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data?.internalData).toContain('Internal data');
    });
  });

  describe('Cognito group restrictions', () => {
    it('Cognito user WITHOUT Admin group CANNOT access adminStats', async () => {
      const result = await graphqlWithCognito(
        `
        query {
          adminStats {
            totalUsers
          }
        }
      `,
        {},
        ['Users', 'Editors'] // Not in Admin group
      );

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toContain('Not Authorized');
    });

    it('Cognito user WITH Admin group CAN access adminStats', async () => {
      const result = await graphqlWithCognito<{ adminStats: { totalUsers: number } }>(
        `
        query {
          adminStats {
            totalUsers
            activeUsers
          }
        }
      `,
        {},
        ['Admin'] // In Admin group
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.adminStats?.totalUsers).toBe(1250);
    });

    it('Cognito user without Admin group CANNOT delete user', async () => {
      const result = await graphqlWithCognito(
        `
        mutation {
          deleteUser(id: "1")
        }
      `,
        {},
        ['Users'] // Not Admin
      );

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toContain('Not Authorized');
    });

    it('Cognito Admin CAN delete user', async () => {
      const result = await graphqlWithCognito<{ deleteUser: boolean }>(
        `
        mutation {
          deleteUser(id: "1")
        }
      `,
        {},
        ['Admin']
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.deleteUser).toBe(true);
    });
  });

  describe('Mutation type-level directive', () => {
    it('API key CANNOT access mutations (Mutation type has @aws_cognito_user_pools)', async () => {
      const result = await graphqlWithApiKey(`
        mutation {
          updateProfile(input: { name: "Test" }) {
            id
          }
        }
      `);

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toContain('Not Authorized');
    });

    it('Cognito CAN access mutations', async () => {
      const result = await graphqlWithCognito<{ updateProfile: { name: string } }>(`
        mutation {
          updateProfile(input: { name: "Updated Name" }) {
            name
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data?.updateProfile?.name).toBe('Updated Name');
    });
  });

  describe('Mixed queries with different auth requirements', () => {
    it('API key can access allowed fields but not restricted ones in same query', async () => {
      // publicData is allowed, myProfile is not
      const result = await graphqlWithApiKey(`
        query {
          publicData
          myProfile {
            id
          }
        }
      `);

      // Should have error for myProfile
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toContain('myProfile');
    });
  });

  describe('Cascading authorization (return type check)', () => {
    it('API key CANNOT access getSecretData (field allowed but return type requires IAM)', async () => {
      // Query.getSecretData inherits @aws_api_key from Query type
      // But SecretData type has @aws_iam - cascading check blocks API_KEY
      const result = await graphqlWithApiKey(`
        query {
          getSecretData {
            secretId
            secretValue
          }
        }
      `);

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toContain('SecretData');
      expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHORIZED');
    });

    it('IAM CAN access getSecretData (both field and return type allow IAM)', async () => {
      // Query allows API_KEY and Cognito, but SecretData requires IAM
      // IAM should work because SecretData allows it
      const result = await graphqlWithIAM<{
        getSecretData: { secretId: string; secretValue: string; classification: string };
      }>(`
        query {
          getSecretData {
            secretId
            secretValue
            classification
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data?.getSecretData?.secretId).toBe('secret-123');
      expect(result.data?.getSecretData?.secretValue).toBe('TOP_SECRET_VALUE');
      expect(result.data?.getSecretData?.classification).toBe('CLASSIFIED');
    });

    it('Cognito CANNOT access getSecretData (return type requires IAM)', async () => {
      // Even Cognito users can't access because SecretData requires IAM
      const result = await graphqlWithCognito(`
        query {
          getSecretData {
            secretId
          }
        }
      `);

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toContain('SecretData');
    });
  });
});
