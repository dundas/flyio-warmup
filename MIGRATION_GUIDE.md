# Migration Guide: Standardizing Warmup Across Fly.io Apps

## 🎯 Goal

Standardize warmup logic across all mech-* services running on Fly.io to eliminate cold starts consistently using HTTP endpoint warming.

## 📋 Migration Steps

### Step 1: Install @mech/flyio-warmup

```bash
cd your-mech-service
npm install github:dundas/flyio-warmup
# or if published to npm:
npm install @mech/flyio-warmup
```

### Step 2: Replace Custom Warmup with Standardized Service

#### Before (custom implementation):

```typescript
// Custom warmup logic scattered across codebase
async function startServer() {
  // Custom database warmup
  await warmDatabase();
  // Custom cache warmup
  await warmCache();
  // Start server
  app.listen(3000);
}
```

#### After (using @mech/flyio-warmup):

```typescript
import { FlyWarmupService } from '@mech/flyio-warmup';

async function startServer() {
  // Standardized warmup
  const warmup = new FlyWarmupService({
    port: 3000,
    endpoints: [
      { path: '/health', method: 'GET' },
      { path: '/api/ready', method: 'GET' },
    ],
    custom: [
      {
        name: 'database',
        warmupFn: async () => {
          // Your database warmup logic
          await db.pool.query('SELECT 1');
        },
      },
    ],
    logger: logger,
  });

  const result = await warmup.warmup();
  logger.info(`Warmup: ${result.success ? '✅' : '⚠️'} (${result.duration}ms)`);

  // Now start server
  app.listen(3000);
}
```

### Step 3: Add Health/Ready Endpoints (if missing)

The warmup service needs endpoints to hit. Add these if they don't exist:

```typescript
// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Readiness endpoint (optional)
app.get('/api/ready', (req, res) => {
  res.json({ status: 'ready' });
});
```

### Step 4: Update Tests

#### Before:

```typescript
// Custom warmup tests
test('should warm up', async () => {
  await customWarmup();
  expect(customWarmup.isReady()).toBe(true);
});
```

#### After:

```typescript
import { FlyWarmupService } from '@mech/flyio-warmup';

test('should warm up', async () => {
  const warmup = new FlyWarmupService({
    port: 3000,
    endpoints: [
      { path: '/health', method: 'GET' },
    ],
    httpClient: mockFetch, // Mock for testing
  });
  
  const result = await warmup.warmup();
  expect(result.success).toBe(true);
  expect(warmup.isWarmedUp()).toBe(true);
});
```

## 🔄 Service-Specific Examples

### mech-storage (PostgreSQL + Redis)

```typescript
import { FlyWarmupService } from '@mech/flyio-warmup';
import { databaseService } from './services/database.service';
import { cacheService } from './services/cache.service';

const warmup = new FlyWarmupService({
  port: 8080,
  endpoints: [
    { path: '/health', method: 'GET' },
  ],
  custom: [
    {
      name: 'database',
      warmupFn: async () => {
        // Warm PostgreSQL pool
        await databaseService.query('SELECT 1');
      },
    },
    {
      name: 'cache',
      warmupFn: async () => {
        // Warm Redis
        await cacheService.connect();
      },
    },
  ],
  logger: logger,
});

await warmup.warmup();
```

### mech-queue (Redis + API)

```typescript
import { FlyWarmupService } from '@mech/flyio-warmup';

const warmup = new FlyWarmupService({
  port: 3000,
  endpoints: [
    { path: '/health', method: 'GET' },
    { path: '/api/queue/status', method: 'GET' },
  ],
  custom: [
    {
      name: 'redis',
      warmupFn: async () => {
        await redis.ping();
      },
    },
  ],
});

await warmup.warmup();
```

### mech-apps (API only)

```typescript
import { FlyWarmupService } from '@mech/flyio-warmup';

const warmup = new FlyWarmupService({
  port: 3000,
  endpoints: [
    { path: '/health', method: 'GET' },
    { path: '/api/apps', method: 'GET' },
  ],
});

await warmup.warmup();
```

### mech-llms (API + Database)

```typescript
import { FlyWarmupService } from '@mech/flyio-warmup';

const warmup = new FlyWarmupService({
  port: 3000,
  endpoints: [
    { path: '/health', method: 'GET' },
  ],
  custom: [
    {
      name: 'database',
      warmupFn: async () => {
        await db.pool.query('SELECT 1');
      },
    },
  ],
});

await warmup.warmup();
```

## ✅ Checklist for Each Service

- [ ] Install `@mech/flyio-warmup` package
- [ ] Add `/health` endpoint (if missing)
- [ ] Replace custom warmup with `FlyWarmupService`
- [ ] Configure endpoints to warm up
- [ ] Add custom warmup steps for non-HTTP resources (database, cache, etc.)
- [ ] Remove old custom warmup code
- [ ] Update tests to use `@mech/flyio-warmup`
- [ ] Verify warmup runs BEFORE server accepts traffic
- [ ] Test warmup in development
- [ ] Deploy and monitor warmup performance

## 🎯 Benefits of Standardization

1. **Consistency** - Same warmup pattern across all services
2. **Simplicity** - Just warm HTTP endpoints + custom steps
3. **Maintainability** - One library to update instead of N custom implementations
4. **Reliability** - Battle-tested warmup logic
5. **Observability** - Standardized warmup metrics
6. **Technology Agnostic** - Works with any stack

## 📊 Monitoring Standardization

Add warmup status to health endpoints:

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    warmup: warmup.getStats(),
  });
});
```

This allows consistent monitoring across all services.

## 🚀 Migration Phases

### Phase 1: Reference Implementation
- Migrate `mech-storage` first (already has warmup)
- Document patterns and best practices

### Phase 2: High-Traffic Services
- Migrate `mech-queue`
- Migrate `mech-apps`
- Migrate `mech-llms`

### Phase 3: Remaining Services
- Migrate all other mech-* services
- Ensure consistent warmup across platform

### Phase 4: Monitoring & Optimization
- Add centralized warmup monitoring
- Optimize warmup times
- Share learnings across team

## 📝 Notes

- **Endpoints must exist** - The warmup service hits actual HTTP endpoints
- **Server must be ready** - Endpoints need to be registered before warmup
- **Use custom steps** - For non-HTTP resources (database, cache, etc.)
- **Non-blocking** - Warmup failures don't prevent server startup (unless marked `required: true`)
