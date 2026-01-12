import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type ChildProcess, spawn } from 'child_process';
import path from 'path';

const projectRoot = process.cwd();

const PORT = 4003;
const GRAPHQL_URL = `http://localhost:${PORT}/`;

// Helper to wait for server to be ready
async function waitForServer(url: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return response.json() as Promise<{ data?: T; errors?: Array<{ message: string }> }>;
}

describe('E2E: Lambda Auth with Mock Identity', () => {
  let serverProcess: ChildProcess;

  beforeAll(async () => {
    const configPath = path.join(projectRoot, 'examples/lambda-auth/appsync-config.json');

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

  describe('Query: me', () => {
    it('should return identity from mock config', async () => {
      const result = await graphql<{
        me: {
          sub: string;
          username: string;
          groups: string[];
          resolverContext: { tenantId: string; role: string };
        };
      }>(`
        query Me {
          me {
            sub
            username
            groups
            resolverContext {
              tenantId
              role
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data?.me.sub).toBe('user-123');
      expect(result.data?.me.username).toBe('testuser');
      expect(result.data?.me.groups).toEqual(['admin', 'users']);
      expect(result.data?.me.resolverContext.tenantId).toBe('tenant-abc');
      expect(result.data?.me.resolverContext.role).toBe('admin');
    });
  });

  describe('Query: echo', () => {
    it('should have access to identity and resolverContext', async () => {
      const result = await graphql<{
        echo: { message: string; userId: string; tenantId: string };
      }>(
        `
        query Echo($message: String!) {
          echo(message: $message) {
            message
            userId
            tenantId
          }
        }
      `,
        { message: 'Hello from Lambda auth!' }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.echo.message).toBe('Hello from Lambda auth!');
      expect(result.data?.echo.userId).toBe('user-123');
      expect(result.data?.echo.tenantId).toBe('tenant-abc');
    });
  });
});
