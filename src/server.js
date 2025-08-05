import path from 'path';

import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { loadTypedefsSync } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { buildResolverMap } from './resolverHandlers/index.js';

/** Initialize DynamoDB client */
function initializeDynamoDB() {
  const ddbClient = new DynamoDBClient({
    endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'fakeMyKeyId',
      secretAccessKey: 'fakeSecretAccessKey'
    }
  });
  return DynamoDBDocumentClient.from(ddbClient);
}

export async function startServer({ port, schema, apiConfig, resolvers, dataSources }) {
  // Initialize DynamoDB
  const docClient = initializeDynamoDB();

  // Load GraphQL schema
  const [{ document: typeDefs }] = loadTypedefsSync(
    path.resolve(process.cwd(), schema),
    { loaders: [new GraphQLFileLoader()] }
  );

  // Build resolver map
  const map = await buildResolverMap(docClient, resolvers, dataSources);

  // Setup Apollo Server v5
  const server = new ApolloServer({
    schema: makeExecutableSchema({ typeDefs, resolvers: map }),
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port },
    context: async ({ req }) => ({ headers: req.headers }),
  });

  console.log(`🚀  ${url}`);
  return Promise.resolve();
}