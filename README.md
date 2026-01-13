# appsync-local

[![CI](https://github.com/abanobmikaeel/appsync-local-server/actions/workflows/ci.yml/badge.svg)](https://github.com/abanobmikaeel/appsync-local-server/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/appsync-local-server)](https://www.npmjs.com/package/appsync-local-server)
[![npm downloads](https://img.shields.io/npm/dm/appsync-local-server)](https://www.npmjs.com/package/appsync-local-server)
[![codecov](https://codecov.io/gh/abanobmikaeel/appsync-local-server/branch/main/graph/badge.svg)](https://codecov.io/gh/abanobmikaeel/appsync-local-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Run AWS AppSync JavaScript resolvers locally. No VTL, just JavaScript.

## Install

```bash
npm install -g appsync-local-server
```

## Usage

```bash
appsync-local start -c appsync-config.json -p 4000
```

Server starts at `http://localhost:4000/`

## Config File

```json
{
  "schema": "./schema.graphql",
  "apiConfig": {
    "auth": [{ "type": "API_KEY", "key": "dev-key" }]
  },
  "dataSources": [
    { "type": "NONE", "name": "LocalDS" }
  ],
  "resolvers": [
    {
      "type": "Query",
      "field": "getUser",
      "kind": "Unit",
      "dataSource": "LocalDS",
      "file": "./resolvers/getUser.js"
    }
  ]
}
```

## Resolver Format

Resolvers export `request` and `response` functions:

```javascript
// resolvers/getUser.js
export function request(ctx) {
  return { id: ctx.arguments.id };
}

export function response(ctx) {
  return { id: ctx.prev.result.id, name: 'Alice' };
}
```

Context (`ctx`) includes:
- `ctx.arguments` - GraphQL arguments
- `ctx.prev.result` - Result from request function (or previous pipeline function)
- `ctx.stash` - Shared data across pipeline functions
- `ctx.source` - Parent resolver result
- `ctx.identity` - Auth identity info
- `ctx.request.headers` - HTTP headers

## Using @aws-appsync/utils

Write your resolvers exactly as you would for AWS AppSync. Standard imports work seamlessly:

```javascript
// resolvers/createUser.js
import { util } from '@aws-appsync/utils';
import { put } from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  return put({
    key: { id: util.autoId() },
    item: {
      ...ctx.arguments.input,
      createdAt: util.time.nowISO8601()
    }
  });
}

export function response(ctx) {
  return ctx.prev.result;
}
```

The same resolver code works locally and when deployed to AWS AppSync.

### Available Utilities

**Globals** (`util`, `runtime`, `extensions`) are also available without imports:

```javascript
export function request(ctx) {
  // util is a global - no import needed
  return { id: util.autoId(), timestamp: util.time.nowEpochSeconds() };
}
```

**DynamoDB helpers** from `@aws-appsync/utils/dynamodb`:
- `get()`, `put()`, `update()`, `remove()` - Single item operations
- `query()`, `scan()` - Query and scan operations
- `batchGet()`, `batchPut()`, `batchDelete()` - Batch operations
- `transactGet()`, `transactWrite()` - Transactions
- `operations` - Update expression builders (`increment`, `append`, etc.)

### TypeScript Support

Install `@aws-appsync/utils` for TypeScript types:

```bash
npm install --save-dev @aws-appsync/utils
```

## Data Sources

### NONE
For pure JavaScript logic, no external calls:

```json
{ "type": "NONE", "name": "LocalDS" }
```

### DYNAMODB
Supports both local DynamoDB and real AWS DynamoDB.

**Local DynamoDB:**
```json
{
  "type": "DYNAMODB",
  "name": "UsersTable",
  "config": {
    "tableName": "users",
    "region": "us-east-1",
    "endpoint": "http://localhost:8000",
    "accessKeyId": "fakeId",
    "secretAccessKey": "fakeSecret"
  }
}
```

Start local DynamoDB (Docker):
```bash
docker run -p 8000:8000 amazon/dynamodb-local
```

Or with Java (no Docker):
```bash
# Download DynamoDB Local
curl -sL "https://d1ni2b6xgvw0s0.cloudfront.net/v2.x/dynamodb_local_latest.tar.gz" | tar -xz -C ~/dynamodb-local
# Run it
java -jar ~/dynamodb-local/DynamoDBLocal.jar -sharedDb -port 8000
```

**Real AWS DynamoDB:**
```json
{
  "type": "DYNAMODB",
  "name": "UsersTable",
  "config": {
    "tableName": "users",
    "region": "us-east-1"
  }
}
```
Omit `endpoint` to connect to real AWS. Credentials are loaded from the default AWS credential chain (env vars, ~/.aws/credentials, IAM role).

### LAMBDA
Execute local JavaScript as Lambda:

```json
{
  "type": "LAMBDA",
  "name": "MyLambda",
  "config": {
    "functionName": "processor",
    "file": "./lambdas/processor.js"
  }
}
```

Lambda file exports a handler:
```javascript
export async function handler(event, context) {
  return { result: event.input * 2 };
}
```

### HTTP
Call external HTTP APIs:

```json
{
  "type": "HTTP",
  "name": "RestAPI",
  "config": {
    "endpoint": "https://api.example.com",
    "defaultHeaders": { "Authorization": "Bearer token" }
  }
}
```

Resolver builds HTTP request:
```javascript
export function request(ctx) {
  return {
    method: 'GET',
    resourcePath: `/users/${ctx.arguments.id}`,
    params: {
      headers: { 'Accept': 'application/json' }
    }
  };
}

export function response(ctx) {
  return ctx.prev.result.body;
}
```

### RDS
Supports both direct database connections and AWS RDS Data API.

**Local/Direct Connection:**
```json
{
  "type": "RDS",
  "name": "Database",
  "config": {
    "engine": "postgresql",
    "databaseName": "mydb",
    "mode": "local",
    "host": "localhost",
    "port": 5432,
    "user": "postgres",
    "password": "password"
  }
}
```

**AWS RDS Data API:**
```json
{
  "type": "RDS",
  "name": "Database",
  "config": {
    "engine": "postgresql",
    "databaseName": "mydb",
    "mode": "aws",
    "region": "us-east-1",
    "resourceArn": "arn:aws:rds:us-east-1:123456789:cluster:my-cluster",
    "awsSecretStoreArn": "arn:aws:secretsmanager:us-east-1:123456789:secret:my-secret"
  }
}
```

Resolver executes SQL:
```javascript
export function request(ctx) {
  return {
    operation: 'executeStatement',
    sql: 'SELECT * FROM users WHERE id = :id',
    variableMap: { id: ctx.arguments.id }
  };
}

export function response(ctx) {
  return ctx.prev.result.records[0];
}
```

## Pipeline Resolvers

Chain multiple functions:

```json
{
  "type": "Mutation",
  "field": "createUser",
  "kind": "Pipeline",
  "file": "./resolvers/createUser.js",
  "pipelineFunctions": [
    { "file": "./functions/validate.js", "dataSource": "LocalDS" },
    { "file": "./functions/save.js", "dataSource": "UsersTable" }
  ]
}
```

Main resolver wraps the pipeline:
```javascript
// resolvers/createUser.js
export function request(ctx) {
  ctx.stash.input = ctx.arguments.input;
  return {};
}

export function response(ctx) {
  return ctx.stash.result;
}
```

Each function in the pipeline:
```javascript
// functions/validate.js
export function request(ctx) {
  if (!ctx.stash.input.email) {
    throw new Error('Email required');
  }
  return {};
}

export function response(ctx) {
  return ctx.prev.result;
}
```

## Authentication

### API Key
```json
{
  "type": "API_KEY",
  "key": "your-dev-key"
}
```

### Lambda Authorizer

**With local Lambda file:**
```json
{
  "type": "AWS_LAMBDA",
  "lambdaFunction": "./auth/authorizer.js"
}
```

**With mock identity (for local development without a Lambda):**
```json
{
  "type": "AWS_LAMBDA",
  "identity": {
    "sub": "user-123",
    "username": "testuser",
    "groups": ["admin"]
  },
  "resolverContext": {
    "tenantId": "tenant-abc",
    "role": "admin"
  }
}
```

The `identity` fields are available in resolvers via `ctx.identity`:
- `ctx.identity.sub` - User ID
- `ctx.identity.username` - Username
- `ctx.identity.groups` - User groups array

The `resolverContext` is available via `ctx.identity.resolverContext` and merged into `ctx.identity.claims`.

### Cognito User Pools
```json
{
  "type": "AMAZON_COGNITO_USER_POOLS",
  "userPoolId": "us-east-1_xxxxx"
}
```

### OpenID Connect
```json
{
  "type": "OPENID_CONNECT",
  "issuer": "https://your-issuer.com",
  "clientId": "your-client-id"
}
```

### IAM
```json
{
  "type": "AWS_IAM"
}
```

### Multiple Auth Methods
You can configure multiple auth methods. The first one that succeeds will be used:
```json
{
  "apiConfig": {
    "auth": [
      { "type": "AWS_LAMBDA", "identity": { "sub": "dev-user" } },
      { "type": "API_KEY", "key": "fallback-key" }
    ]
  }
}
```

## Full Example

See `examples/basic/` for a working setup.

Run it:
```bash
npx appsync-local start -c examples/basic/appsync-config.json -p 4000
```

Query:
```bash
curl -X POST http://localhost:4000/ \
  -H "Content-Type: application/json" \
  -d '{"query": "{ listUsers { id name email } }"}'
```

## Limitations

- JavaScript resolvers only (no VTL)
- Local simulation, not real AWS services
- No subscriptions

## Development

```bash
npm install
npm run dev -- -c examples/basic/appsync-config.json -p 4000
npm test
npm run test:e2e
```
