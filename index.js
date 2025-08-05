import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { importSchema } from 'graphql-import';
import { makeExecutableSchema } from '@graphql-tools/schema';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import resolvers from './resolvers/exampleResolver.js';
import jwtVerifier from './utils/jwtVerifier.js';
import config from './config/appsync-config.json';

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('port', {
    alias: 'p',
    description: 'Port to run the server on',
    type: 'number',
    default: config.port || 4000
  })
  .option('schema', {
    alias: 's',
    description: 'Path to schema file',
    type: 'string',
    default: './src/schema/schema.graphql'
  })
  .help()
  .argv;

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  const token = req.headers.authorization || '';
  jwtVerifier(token)
    .then(() => next())
    .catch(err => res.status(401).send(err.message));
});

const typeDefs = importSchema(argv.schema);
const schema = makeExecutableSchema({ typeDefs, resolvers });

const server = new ApolloServer({ schema });

server.applyMiddleware({ app });

app.listen(argv.port, () => {
  console.log(`Server is running on http://localhost:${argv.port}${server.graphqlPath}`);
});
