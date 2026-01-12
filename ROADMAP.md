# AppSync Local - Roadmap

## Current Compatibility: ~80%

### What's Implemented

| Category | Feature | Status |
|----------|---------|--------|
| **Context** | ctx.arguments, ctx.args | ✅ |
| | ctx.source | ✅ |
| | ctx.identity | ✅ |
| | ctx.stash | ✅ |
| | ctx.prev | ✅ |
| | ctx.request (headers) | ✅ |
| | ctx.info | ✅ |
| | ctx.env | ✅ |
| **Error Handling** | util.error() | ✅ |
| | util.appendError() | ✅ |
| | util.unauthorized() | ✅ |
| **ID Generation** | util.autoId() | ✅ |
| | util.autoUlid() | ✅ |
| | util.autoKsuid() | ✅ |
| **Encoding** | util.base64Encode/Decode() | ✅ |
| | util.urlEncode/Decode() | ✅ |
| | util.escapeJavaScript() | ✅ |
| **Validation** | util.matches() | ✅ |
| | util.isNull/isNullOrEmpty/isNullOrBlank() | ✅ |
| | util.defaultIfNull/Empty/Blank() | ✅ |
| | util.typeOf() | ✅ |
| **Time** | util.time.nowISO8601() | ✅ |
| | util.time.nowEpochSeconds/MilliSeconds() | ✅ |
| | util.time.nowFormatted() | ✅ |
| | util.time.parseISO8601ToEpochMilliSeconds() | ✅ |
| | util.time.epochMilliSecondsToISO8601() | ✅ |
| **DynamoDB** | util.dynamodb.toDynamoDB() | ✅ |
| | util.dynamodb.toMapValues() | ✅ |
| | util.dynamodb.to[Type]() (all types) | ✅ |
| | util.dynamodb.toS3Object() | ✅ |
| **String** | util.str.toUpper/toLower() | ✅ |
| | util.str.toReplace() | ✅ |
| | util.str.normalize() | ✅ |
| **Math** | util.math.roundNum() | ✅ |
| | util.math.minVal/maxVal() | ✅ |
| | util.math.randomDouble/randomWithinRange() | ✅ |
| **Transform** | util.transform.toJson/toJsonPretty() | ✅ |
| **HTTP** | util.http.copyHeaders() | ✅ |
| | util.http.addResponseHeader(s)() | ✅ |
| **XML** | util.xml.toMap() | ✅ |
| | util.xml.toJsonString() | ✅ |
| **Resolvers** | Unit Resolvers | ✅ |
| | Pipeline Resolvers | ✅ |
| **Data Sources** | NONE | ✅ |
| | AWS_LAMBDA | ✅ |
| | AMAZON_DYNAMODB | ✅ |
| | HTTP | ✅ |
| | RELATIONAL_DATABASE (RDS) | ✅ |
| **Auth** | API_KEY | ✅ |
| | AMAZON_COGNITO_USER_POOLS (JWT) | ✅ |
| | AWS_LAMBDA (Custom) | ✅ |
| | AWS_IAM | ✅ |
| **Runtime** | runtime.earlyReturn() | ✅ |
| **Extensions** | extensions.setSubscriptionFilter() | ✅ |
| | extensions.invalidateSubscriptions() | ✅ |
| | extensions.evictFromApiCache() | ✅ |
| **Transform** | util.transform.toSubscriptionFilter() | ✅ |
| | util.transform.toDynamoDBFilterExpression() | ✅ |
| | util.transform.toDynamoDBConditionExpression() | ✅ |
| **@aws-appsync/utils** | import { util, Context } from '@aws-appsync/utils' | ✅ |
| | import { get, put, query, scan, remove } from '@aws-appsync/utils/dynamodb' | ✅ |
| | import { update, operations } from '@aws-appsync/utils/dynamodb' | ✅ |

### What's Missing (Target: 95%+)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| ~~**P0**~~ | ~~runtime.earlyReturn()~~ | ~~Small~~ | ~~High~~ | ✅ Done |
| ~~**P0**~~ | ~~util.transform.toSubscriptionFilter()~~ | ~~Small~~ | ~~Medium~~ | ✅ Done |
| ~~**P1**~~ | ~~extensions.setSubscriptionFilter()~~ | ~~Medium~~ | ~~Medium~~ | ✅ Done |
| ~~**P1**~~ | ~~extensions.invalidateSubscriptions()~~ | ~~Medium~~ | ~~Medium~~ | ✅ Done |
| ~~**P1**~~ | ~~extensions.evictFromApiCache()~~ | ~~Medium~~ | ~~Low~~ | ✅ Done |
| ~~**P1**~~ | ~~util.transform.toDynamoDBFilterExpression()~~ | ~~Medium~~ | ~~High~~ | ✅ Done |
| ~~**P1**~~ | ~~util.transform.toDynamoDBConditionExpression()~~ | ~~Medium~~ | ~~High~~ | ✅ Done |
| **P2** | OpenSearch/Elasticsearch data source | Large | Medium |
| **P2** | EventBridge data source | Medium | Low |
| **P2** | Full Java DateTimeFormatter parsing | Medium | Low |
| **P3** | WebSocket subscriptions | Large | High |

---

## Roadmap

### Phase 1: 95% Runtime Compatibility ✅ COMPLETE

- [x] **runtime.earlyReturn()** - Allow early exit from pipeline functions
- [x] **util.transform.toDynamoDBFilterExpression()** - Generate DynamoDB filter expressions
- [x] **util.transform.toDynamoDBConditionExpression()** - Generate condition expressions
- [x] **util.transform.toSubscriptionFilter()** - Convert filter objects
- [x] **extensions module** - setSubscriptionFilter, invalidateSubscriptions, evictFromApiCache
- [x] **@aws-appsync/utils imports** - Full support for importing from @aws-appsync/utils and @aws-appsync/utils/dynamodb

### Phase 2: Developer Experience

- [ ] **Visual UI** - Hyper-lightweight web interface
  - Resolver map visualization (directed graph)
  - Code flow tracing
  - Request/response inspector
  - Real-time logs
- [ ] **Hot reload** - Watch mode for resolver files
- [ ] **Better error messages** - Show exact line numbers in resolver errors
- [ ] **OpenTelemetry tracing** - Export traces for debugging

### Phase 3: Advanced Features

- [ ] **WebSocket subscriptions** - Real-time support for local dev
- [ ] **OpenSearch data source** - Elasticsearch queries
- [ ] **EventBridge data source** - Event publishing
- [ ] **Caching simulation** - Local cache behavior

---

## UI Vision

### Resolver Flow Visualizer

```
┌─────────────────────────────────────────────────────────────┐
│  Query.getUser                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ authFunc │ -> │ getUser  │ -> │ enricher │ -> Response  │
│  └──────────┘    └──────────┘    └──────────┘              │
│       │               │               │                     │
│       v               v               v                     │
│   [Lambda]       [DynamoDB]      [HTTP API]                │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Click any node to see code
- Hover to see ctx.stash state
- Trace requests through pipeline
- Export as diagram

### Tech Stack (Lightweight)
- Single HTML file with inline JS/CSS
- No build step, no React/Vue bloat
- D3.js or vanilla Canvas for graphs
- WebSocket for live updates
- < 100KB total

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to help.

**Quick wins for contributors:**
1. Add AppSync limit enforcement (`--strict` flag)
2. Hot reload / watch mode for resolver files
3. Write tests for edge cases

---

---

## AppSync Limits (Enforce Locally)

We should **warn or enforce** these limits locally to catch issues before deployment:

| Limit | Value | Status |
|-------|-------|--------|
| Resolver/function code size | 32 KB | ⚠️ TODO |
| Request execution time | 30 seconds | ⚠️ TODO |
| Response size | 5 MB | ⚠️ TODO |
| Subscription payload | 240 KB | ⚠️ TODO |
| Functions per pipeline | 10 | ⚠️ TODO |
| Loop iterations | 1,000 | ⚠️ TODO |
| Schema document size | 1 MB | ⚠️ TODO |
| Resolvers per request | 10,000 | ⚠️ TODO |
| Caching keys per resolver | 25 | ⚠️ TODO |
| Batch size per request | 2,000 | ⚠️ TODO |

**Implementation:** Add `--strict` flag to enforce limits, `--warn` to show warnings only.

---

## Caching Simulation

### Goal
Simulate AppSync's server-side caching behavior locally.

### How AppSync Caching Works
- **Full Request Caching**: Cache all resolver results
- **Per-Resolver Caching**: Opt-in per resolver with custom TTL & keys
- **Cache Keys**: Built from `ctx.arguments`, `ctx.source`, `ctx.identity`
- **TTL**: 1-3600 seconds
- **Eviction**: `extensions.evictFromApiCache(typeName, fieldName, keys)`

### Local Implementation Plan
```javascript
// appsync-config.json
{
  "caching": {
    "enabled": true,
    "type": "PER_RESOLVER",  // or "FULL_REQUEST"
    "defaultTtl": 300
  },
  "resolvers": [{
    "type": "Query",
    "field": "getUser",
    "caching": {
      "enabled": true,
      "ttl": 60,
      "keys": ["ctx.arguments.id"]
    }
  }]
}
```

**Features:**
- [ ] In-memory cache (Map-based)
- [ ] TTL expiration
- [ ] Cache key generation from ctx
- [x] `extensions.evictFromApiCache()` support
- [ ] Cache hit/miss logging
- [ ] UI: Show cache status per request

---

## Subscriptions (Real-Time)

### How AppSync Subscriptions Work
1. Client opens WebSocket to AppSync
2. Client subscribes to mutation events
3. When mutation fires, AppSync pushes to subscribed clients
4. Filters can narrow which events reach which clients

### Local Implementation Plan

**Phase 1: Basic WebSocket Support**
```graphql
type Subscription {
  onCreateUser: User @aws_subscribe(mutations: ["createUser"])
}
```

- [ ] WebSocket server (ws library)
- [ ] Track active subscriptions per connection
- [ ] Broadcast mutation results to subscribers
- [ ] Connection auth (API key, JWT)

**Phase 2: Enhanced Filtering**
```javascript
// Resolver
export function response(ctx) {
  extensions.setSubscriptionFilter(
    util.transform.toSubscriptionFilter({
      group: { eq: ctx.args.group }
    })
  );
  return null;
}
```

- [x] `extensions.setSubscriptionFilter()`
- [x] `extensions.invalidateSubscriptions()`
- [ ] Filter evaluation engine
- [ ] Max 200 subscriptions per connection

**Phase 3: UI Integration**
- [ ] Show active WebSocket connections
- [ ] List subscriptions per connection
- [ ] Real-time event log
- [ ] Test subscription from UI

### Subscription Limits to Enforce
| Limit | Value |
|-------|-------|
| Subscriptions per connection | 200 |
| Payload size | 240 KB |
| Inbound messages/sec | 10,000 |
| Outbound messages/sec | 1,000,000 |

---

## Links

- [AWS AppSync JS Runtime Docs](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-util-reference-js.html)
- [AppSync Context Reference](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-context-reference-js.html)
- [Extensions Reference](https://docs.aws.amazon.com/appsync/latest/devguide/extensions.html)
- [AppSync Quotas](https://docs.aws.amazon.com/general/latest/gr/appsync.html)
- [Caching Configuration](https://docs.aws.amazon.com/appsync/latest/devguide/enabling-caching.html)
- [Real-Time Subscriptions](https://docs.aws.amazon.com/appsync/latest/devguide/aws-appsync-real-time-data.html)
