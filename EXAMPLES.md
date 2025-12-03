# Usage Examples

## Basic Example - Express App

```typescript
import express from 'express';
import { FlyWarmupService } from '@mech/warmup';

const app = express();
const PORT = process.env.PORT || 3000;

// Define your routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', warmup: warmup.getStats() });
});

app.get('/api/data', (req, res) => {
  res.json({ data: 'example' });
});

// Initialize warmup service
const warmup = new FlyWarmupService({
  port: PORT,
  endpoints: [
    { path: '/health', method: 'GET' },
  ],
  logger: console,
});

async function start() {
  // Warm up BEFORE starting server
  const result = await warmup.warmup();
  console.log(`Warmup: ${result.success ? '✅' : '⚠️'} (${result.duration}ms)`);
  
  // Now start server
  app.listen(PORT, () => {
    console.log(`Server ready on port ${PORT}`);
  });
}

start();
```

## With Database Warmup

```typescript
import { FlyWarmupService } from '@mech/warmup';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const warmup = new FlyWarmupService({
  port: 3000,
  endpoints: [
    { path: '/health', method: 'GET' },
  ],
  custom: [
    {
      name: 'database',
      warmupFn: async () => {
        // Warm database pool
        await Promise.all([
          pool.query('SELECT 1'),
          pool.query('SELECT 1'),
          pool.query('SELECT 1'),
        ]);
      },
    },
  ],
});

await warmup.warmup();
```

## With Multiple Endpoints

```typescript
const warmup = new FlyWarmupService({
  port: 3000,
  endpoints: [
    { path: '/health', method: 'GET', count: 3 },      // Hit 3 times
    { path: '/api/ready', method: 'GET' },              // Hit once
    { path: '/api/metrics', method: 'GET' },            // Hit once
    { 
      path: '/api/warmup', 
      method: 'POST', 
      body: { action: 'warm' },
      headers: { 'X-API-Key': 'warmup-key' },
    },
  ],
});

await warmup.warmup();
```

## With Custom Base URL

```typescript
const warmup = new FlyWarmupService({
  baseUrl: 'http://localhost:8080',  // Custom base URL
  endpoints: [
    { path: '/health', method: 'GET' },
  ],
});

await warmup.warmup();
```

## Error Handling

```typescript
const warmup = new FlyWarmupService({
  port: 3000,
  endpoints: [
    { path: '/health', method: 'GET', required: true },  // Must succeed
    { path: '/api/optional', method: 'GET', required: false },  // Can fail
  ],
  custom: [
    {
      name: 'database',
      warmupFn: async () => {
        await db.connect();
      },
      required: true,  // Must succeed
    },
  ],
});

const result = await warmup.warmup();

if (!result.success) {
  const failedSteps = result.steps.filter(s => !s.success);
  console.error('Failed steps:', failedSteps.map(s => s.name));
  
  // Decide whether to start server
  const criticalFailures = failedSteps.filter(s => {
    const endpoint = warmup.options.endpoints?.find(e => `endpoint:${e.path}` === s.name);
    return endpoint?.required || false;
  });
  
  if (criticalFailures.length > 0) {
    console.error('Critical warmup failures, exiting');
    process.exit(1);
  }
}

// Start server
app.listen(3000);
```

