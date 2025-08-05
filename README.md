# AppSync Local Server

A tool for running and testing AWS AppSync JavaScript resolvers locally without the need for a data source. This project allows developers to simulate AppSync functionality in a local environment, making it easier to develop and test GraphQL APIs.

## Features

- Support for JavaScript resolvers that do not use a data source.
- Customizable schema and resolver configuration.
- JWT verification for secure access to the API.

## Project Structure

```
appsync-local-server
├── src
│   ├── index.js            # Entry point of the application
│   ├── server.js           # Local AppSync server setup
│   ├── schema              # GraphQL schema definitions
│   │   └── schema.graphql  # Main GraphQL schema file
│   ├── resolvers           # Resolver functions
│   │   └── exampleResolver.js # Example resolver implementation
│   ├── config              # Configuration files
│   │   └── appsync-config.json # AppSync configuration settings
│   └── utils               # Utility functions
│       └── jwtVerifier.js  # JWT verification logic
├── package.json            # NPM package configuration
└── README.md               # Project documentation
```

## Installation

1. Clone the repo  
2. `cd example && npm install`  
3. `npm link ../`  # to link your CLI globally
4. `npm run start:local`  

## Usage

To start the local AppSync server, run the following command:

```
node src/index.js
```

This will initialize the server, load the schema, and set up the resolvers.

## Configuration

The configuration for the AppSync server can be found in `src/config/appsync-config.json`. This file allows you to specify resolver locations and JWT verification settings.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the ISC License.
