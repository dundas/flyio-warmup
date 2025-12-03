# @mech/warmup - Standardized Warmup Library

## 📦 Package Overview

A lightweight, technology-agnostic warmup service for Fly.io applications that eliminates cold starts by pre-warming HTTP endpoints and custom resources.

## 🎯 Key Features

- ✅ **HTTP Endpoint Warming** - Pre-warms API endpoints before accepting traffic
- ✅ **Custom Warmup Steps** - Add your own warmup logic (database, cache, etc.)
- ✅ **Technology Agnostic** - Works with Express, Fastify, NestJS, or any Node.js framework
- ✅ **Non-blocking Failures** - Warmup failures don't prevent server startup
- ✅ **TypeScript Support** - Full type definitions included
- ✅ **Zero Dependencies** - Uses native fetch or optional node-fetch

## 📁 Package Structure

```
mech-warmup/
├── src/
│   └── index.ts          # Main warmup service
├── dist/                 # Compiled output (after build)
├── package.json
├── tsconfig.json
├── README.md             # Full documentation
├── EXAMPLES.md           # Usage examples
├── MIGRATION_GUIDE.md    # Migration guide for existing services
└── SUMMARY.md            # This file
```

## 🚀 Quick Usage

```typescript
import { FlyWarmupService } from '@mech/warmup';

const warmup = new FlyWarmupService({
  port: 3000,
  endpoints: [
    { path: '/health', method: 'GET' },
  ],
  custom: [
    {
      name: 'database',
      warmupFn: async () => await db.connect(),
    },
  ],
});

await warmup.warmup();
app.listen(3000);
```

## 📊 What It Does

1. **Warms HTTP Endpoints** - Hits specified endpoints to prime routes, middleware, and handlers
2. **Executes Custom Steps** - Runs custom async functions for database, cache, etc.
3. **Tracks Results** - Returns detailed warmup results with timing
4. **Non-blocking** - Failures don't prevent server startup (unless marked `required: true`)

## 🔄 Migration from Custom Warmup

### Before (Custom):
```typescript
await warmDatabase();
await warmCache();
app.listen(3000);
```

### After (Standardized):
```typescript
const warmup = new FlyWarmupService({
  port: 3000,
  endpoints: [{ path: '/health', method: 'GET' }],
  custom: [
    { name: 'database', warmupFn: async () => await warmDatabase() },
    { name: 'cache', warmupFn: async () => await warmCache() },
  ],
});
await warmup.warmup();
app.listen(3000);
```

## 📈 Benefits

1. **Consistency** - Same pattern across all 58+ mech services
2. **Simplicity** - Just configure endpoints and custom steps
3. **Maintainability** - One library instead of N custom implementations
4. **Observability** - Standardized warmup metrics
5. **Flexibility** - Works with any stack or technology

## 🎯 Next Steps

1. **Publish Package** - Publish to npm or GitHub packages
2. **Migrate mech-storage** - Use as reference implementation
3. **Migrate Other Services** - Roll out to all mech-* services
4. **Monitor & Optimize** - Track warmup performance across services

## 📚 Documentation

- **README.md** - Full API documentation
- **EXAMPLES.md** - Code examples for different scenarios
- **MIGRATION_GUIDE.md** - Step-by-step migration guide

## 🔗 Integration with Fly.io

Works seamlessly with Fly.io's health checks:

```toml
[[http_service.checks]]
  grace_period = "120s"  # Allow time for warmup
  path = "/health"
```

The warmup service ensures endpoints are ready before Fly.io starts routing traffic.

