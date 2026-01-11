import { type ChildProcess, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4001;
const GRAPHQL_URL = `http://localhost:${PORT}/`;
const API_KEY = 'test-api-key'; // Must match the key in examples/basic/appsync-config.json

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

// Helper to execute GraphQL query
async function graphql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<{ data?: T; errors?: Array<{ message: string }> }> {
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

describe('E2E: Basic Example', () => {
  let serverProcess: ChildProcess;

  beforeAll(async () => {
    const projectRoot = path.resolve(__dirname, '../..');
    const configPath = path.join(projectRoot, 'examples/basic/appsync-config.json');

    // Start the server using tsx
    serverProcess = spawn('npx', ['tsx', 'bin/appsync-local.ts', 'start', '-c', configPath, '-p', String(PORT)], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Log server output for debugging
    serverProcess.stdout?.on('data', (data) => {
      console.log(`[server]: ${data}`);
    });
    serverProcess.stderr?.on('data', (data) => {
      console.error(`[server error]: ${data}`);
    });

    // Wait for server to be ready
    await waitForServer(GRAPHQL_URL);
  }, 30000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  describe('Query: echo', () => {
    it('should echo the message back', async () => {
      const result = await graphql<{ echo: string }>(
        `
        query Echo($message: String!) {
          echo(message: $message)
        }
      `,
        { message: 'Hello, AppSync!' }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.echo).toBe('Hello, AppSync!');
    });
  });

  describe('Query: listUsers', () => {
    it('should return list of users', async () => {
      const result = await graphql<{ listUsers: Array<{ id: string; name: string; email: string }> }>(`
        query ListUsers {
          listUsers {
            id
            name
            email
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data?.listUsers).toHaveLength(2);
      expect(result.data?.listUsers[0]).toMatchObject({
        id: '1',
        name: 'Alice',
        email: 'alice@example.com',
      });
    });
  });

  describe('Query: getUser', () => {
    it('should return user by id', async () => {
      const result = await graphql<{ getUser: { id: string; name: string } | null }>(
        `
        query GetUser($id: ID!) {
          getUser(id: $id) {
            id
            name
            email
          }
        }
      `,
        { id: '1' }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.getUser).toMatchObject({
        id: '1',
        name: 'Alice',
      });
    });

    it('should return null for non-existent user', async () => {
      const result = await graphql<{ getUser: null }>(
        `
        query GetUser($id: ID!) {
          getUser(id: $id) {
            id
            name
          }
        }
      `,
        { id: '999' }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.getUser).toBeNull();
    });
  });

  describe('Mutation: createUser', () => {
    it('should create a new user', async () => {
      const result = await graphql<{ createUser: { id: string; name: string; email: string; createdAt: string } }>(
        `
        mutation CreateUser($input: CreateUserInput!) {
          createUser(input: $input) {
            id
            name
            email
            createdAt
          }
        }
      `,
        {
          input: {
            name: 'Charlie',
            email: 'charlie@example.com',
          },
        }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.createUser.name).toBe('Charlie');
      expect(result.data?.createUser.email).toBe('charlie@example.com');
      expect(result.data?.createUser.id).toBeDefined();
      expect(result.data?.createUser.createdAt).toBeDefined();
    });
  });

  describe('Mutation: updateUser', () => {
    it('should update an existing user', async () => {
      const result = await graphql<{ updateUser: { id: string; name: string; email: string } | null }>(
        `
        mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
          updateUser(id: $id, input: $input) {
            id
            name
            email
          }
        }
      `,
        {
          id: '1',
          input: { name: 'Alice Updated' },
        }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.updateUser?.name).toBe('Alice Updated');
    });

    it('should return null for non-existent user', async () => {
      const result = await graphql<{ updateUser: null }>(
        `
        mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
          updateUser(id: $id, input: $input) {
            id
            name
          }
        }
      `,
        {
          id: '999',
          input: { name: 'Ghost' },
        }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.updateUser).toBeNull();
    });
  });

  describe('Mutation: deleteUser', () => {
    it('should return true for existing user', async () => {
      const result = await graphql<{ deleteUser: boolean }>(
        `
        mutation DeleteUser($id: ID!) {
          deleteUser(id: $id)
        }
      `,
        { id: '1' }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.deleteUser).toBe(true);
    });

    it('should return false for non-existent user', async () => {
      const result = await graphql<{ deleteUser: boolean }>(
        `
        mutation DeleteUser($id: ID!) {
          deleteUser(id: $id)
        }
      `,
        { id: '999' }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.deleteUser).toBe(false);
    });
  });
});
