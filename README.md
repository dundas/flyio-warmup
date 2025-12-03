# @mech/flyio-warmup

Standardized startup warmup service for Fly.io applications. Eliminates cold starts by pre-warming API endpoints and custom resources before accepting traffic.

## 🎯 Features

- ✅ **HTTP Endpoint Warming** - Pre-warms API endpoints before accepting traffic
- ✅ **Custom Warmup Steps** - Add your own warmup logic (database, cache, etc.)
- ✅ **Non-blocking Failures** - Warmup failures don't prevent server startup
- ✅ **Comprehensive Logging** - Optional logger integration
- ✅ **TypeScript Support** - Full type definitions included
- ✅ **Technology Agnostic** - Works with any stack (Express, Fastify, NestJS, etc.)

## 📦 Installation

```bash
npm install github:dundas/flyio-warmup
# or when published:
npm install @mech/flyio-warmup
```

## 🚀 Quick Start

### Basic Usage (HTTP Endpoints)

```typescript
import { FlyWarmupService } from '@mech/flyio-warmup';

const warmup = new FlyWarmupService({
  port: 3000, // Your app port
  endpoints: [
    { path: '/health', method: 'GET' },
    { path: '/api/ready', method: 'GET' },
  ],
  logger: console, // Optional logger
});

// Warm up BEFORE starting server
await warmup.warmup();

// Now start your server
app.listen(3000);
```

### With Custom Warmup Steps

```typescript
import { FlyWarmupService } from '@mech/flyio-warmup';
import { databaseService } from './services/database';

const warmup = new FlyWarmupService({
  port: 3000,
  endpoints: [
    { path: '/health', method: 'GET' },
  ],
  custom: [
    {
      name: 'database',
      warmupFn: async () => {
        // Warm database connections
        await databaseService.warmPool();
      },
      required: false, // Non-fatal if fails
    },
    {
      name: 'cache',
      warmupFn: async () => {
        // Warm cache
        await cacheService.connect();
      },
      required: false,
    },
  ],
});

await warmup.warmup();
```

### Using Convenience Function

```typescript
import { warmup } from '@mech/flyio-warmup';

await warmup({
  port: 3000,
  endpoints: [
    { path: '/health', method: 'GET' },
  ],
});
```

## 📋 Integration Examples

### Express.js Application

```typescript
import express from 'express';
import { FlyWarmupService } from '@mech/flyio-warmup';

const app = express();
const PORT = process.env.PORT || 3000;

// Define routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

async function startServer() {
  // CRITICAL: Warm up BEFORE accepting traffic
  const warmup = new FlyWarmupService({
    port: PORT,
    endpoints: [
      { path: '/health', method: 'GET' },
    ],
    logger: console,
  });
  
  const result = await warmup.warmup();
  console.log(`Warmup: ${result.success ? '✅' : '⚠️'} (${result.duration}ms)`);
  
  // Now start server
  app.listen(PORT, () => {
    console.log(`Server ready on port ${PORT}`);
  });
}

startServer();
```

### Fastify Application

```typescript
import Fastify from 'fastify';
import { FlyWarmupService } from '@mech/flyio-warmup';

const fastify = Fastify();
const PORT = 3000;

fastify.get('/health', async () => {
  return { status: 'healthy' };
});

async function start() {
  // Warm up first
  const warmup = new FlyWarmupService({
    port: PORT,
    endpoints: [
      { path: '/health', method: 'GET' },
    ],
  });
  
  const result = await warmup.warmup();
  console.log(`Warmup completed: ${result.success ? '✅' : '⚠️'}`);
  
  // Start server
  await fastify.listen({ port: PORT });
}

start();
```

### NestJS Application

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FlyWarmupService } from '@mech/flyio-warmup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const PORT = 3000;
  
  // Warm up before starting
  const warmup = new FlyWarmupService({
    port: PORT,
    endpoints: [
      { path: '/health', method: 'GET' },
    ],
    custom: [
      {
        name: 'database',
        warmupFn: async () => {
          // Warm database from NestJS DI
          const db = app.get('DATABASE_SERVICE');
          await db.warm();
        },
      },
    ],
  });
  
  await warmup.warmup();
  await app.listen(PORT);
}

bootstrap();
```

## 🔧 Configuration Options

### EndpointWarmupConfig

```typescript
{
  path: string;                    // Required: HTTP path (e.g., '/health')
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';  // Optional: HTTP method (default: 'GET')
  body?: any;                      // Optional: Request body for POST/PUT
  headers?: Record<string, string>; // Optional: Custom headers
  count?: number;                  // Optional: Number of requests (default: 1)
  required?: boolean;              // Optional: Fail warmup if this fails (default: false)
}
```

### CustomWarmupConfig

```typescript
{
  name: string;                    // Required: Step name
  warmupFn: () => Promise<void>;   // Required: Async warmup function
  required?: boolean;              // Optional: Fail warmup if this fails (default: false)
}
```

### FlyWarmupOptions

```typescript
{
  baseUrl?: string;                // Optional: Base URL (default: 'http://localhost:PORT')
  port?: number;                    // Optional: Port number (default: 3000)
  endpoints?: EndpointWarmupConfig[]; // Optional: Endpoints to warm
  custom?: CustomWarmupConfig[];    // Optional: Custom warmup steps
  logger?: Logger;                  // Optional: Logger interface
  verbose?: boolean;                 // Optional: Enable verbose logging
  httpClient?: Function;            // Optional: Custom HTTP client
}
```

## 📊 Warmup Result

```typescript
interface WarmupResult {
  success: boolean;        // Overall success (all required steps passed)
  duration: number;        // Total warmup time in milliseconds
  steps: Array<{
    name: string;          // Step name
    success: boolean;      // Step success
    duration: number;      // Step duration in ms
    error?: string;        // Error message if failed
  }>;
}
```

## 🎯 Best Practices

### 1. Always Warm Up Before Accepting Traffic

```typescript
// ✅ GOOD: Warm up first
await warmup.warmup();
app.listen(3000);

// ❌ BAD: Server accepts traffic before warmup
app.listen(3000);
await warmup.warmup(); // Too late!
```

### 2. Warm Critical Endpoints

```typescript
const warmup = new FlyWarmupService({
  port: 3000,
  endpoints: [
    { path: '/health', method: 'GET' },           // Health check
    { path: '/api/ready', method: 'GET' },       // Readiness probe
    { path: '/api/metrics', method: 'GET' },     // Metrics endpoint
  ],
});
```

### 3. Use Custom Steps for Non-HTTP Resources

```typescript
const warmup = new FlyWarmupService({
  port: 3000,
  endpoints: [
    { path: '/health', method: 'GET' },
  ],
  custom: [
    {
      name: 'database',
      warmupFn: async () => {
        // Warm database connections
        await db.pool.query('SELECT 1');
      },
    },
    {
      name: 'cache',
      warmupFn: async () => {
        // Warm cache
        await redis.ping();
      },
    },
  ],
});
```

### 4. Handle Warmup Failures Gracefully

```typescript
const result = await warmup.warmup();

if (!result.success) {
  // Log but don't fail - server can still start
  console.warn('Some warmup steps failed:', 
    result.steps.filter(s => !s.success).map(s => s.name)
  );
}

// Server starts regardless
app.listen(3000);
```

## 🔍 Monitoring

### Check Warmup Status

```typescript
if (warmup.isWarmedUp()) {
  console.log('✅ Warmup complete');
}
```

### Add to Health Endpoint

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    warmup: warmup.getStats(),
  });
});
```

## 🧪 Testing

```typescript
import { FlyWarmupService } from '@mech/flyio-warmup';

// Mock HTTP client for testing
const mockFetch = jest.fn().mockResolvedValue({
  status: 200,
  ok: true,
});

const warmup = new FlyWarmupService({
  port: 3000,
  endpoints: [
    { path: '/health', method: 'GET' },
  ],
  httpClient: mockFetch,
});

const result = await warmup.warmup();
expect(result.success).toBe(true);
expect(mockFetch).toHaveBeenCalled();
```

## 📚 Fly.io Integration

### fly.toml Configuration

Ensure your app doesn't accept traffic until warmup completes:

```toml
[http_service]
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 2  # Keep machines running

[[http_service.checks]]
  grace_period = "120s"  # Allow time for warmup
  interval = "10s"
  timeout = "3s"
  path = "/health"
```

### Health Check Endpoint

```typescript
app.get('/health', (req, res) => {
  // Health check should pass only after warmup
  if (!warmup.isWarmedUp()) {
    return res.status(503).json({ status: 'warming' });
  }
  res.json({ status: 'healthy' });
});
```

## 🚨 Troubleshooting

### Warmup Taking Too Long

- Reduce number of endpoint requests
- Check endpoint response times
- Verify endpoints are accessible locally

### Warmup Failures

- Check logs for specific step failures
- Verify endpoints exist and are accessible
- Ensure server is listening before warmup (use setTimeout if needed)

### Server Starts Before Warmup

- Ensure `await warmup.warmup()` is called BEFORE `app.listen()`
- Check that warmup is not in a callback or async function that runs after server start

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.
