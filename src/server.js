import express from 'express';
import path from 'path';

import { ApolloServer } from 'apollo-server-express';
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

export async function startServer({ port, schema, apiConfig, resolvers }) {
  // Initialize DynamoDB
  const docClient = initializeDynamoDB();

  // Load GraphQL schema
  const [{ document: typeDefs }] = loadTypedefsSync(
    path.resolve(process.cwd(), schema),
    { loaders: [new GraphQLFileLoader()] }
  );

  // Build resolver map
  const map = await buildResolverMap(docClient, resolvers);

  // Setup Express + Apollo
  const app = express();
  const server = new ApolloServer({
    schema: makeExecutableSchema({ typeDefs, resolvers: map }),
    context: ({ req }) => ({ headers: req.headers })
  });

  await server.start();
  server.applyMiddleware({ app, path: '/' });

  return new Promise(resolve => {
    app.listen(port, () => {
      console.log(`🚀  http://localhost:${port}${server.graphqlPath}`);
      resolve();
    });
  });
}