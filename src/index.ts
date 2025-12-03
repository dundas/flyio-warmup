/**
 * @mech/flyio-warmup - Standardized Startup Warmup Service
 * 
 * Provides a reusable warmup service for Fly.io applications to eliminate cold starts.
 * Supports HTTP endpoint warmup and custom warmup strategies.
 * 
 * @example
 * ```typescript
 * import { FlyWarmupService } from '@mech/flyio-warmup';
 * 
 * const warmup = new FlyWarmupService({
 *   endpoints: [
 *     { path: '/health', method: 'GET' },
 *     { path: '/api/ready', method: 'GET' },
 *   ],
 *   custom: [
 *     {
 *       name: 'database',
 *       warmupFn: async () => await db.connect(),
 *     },
 *   ],
 * });
 * 
 * await warmup.warmup();
 * // Server can now accept traffic
 * ```
 */

export interface EndpointWarmupConfig {
  /** HTTP path to warm up */
  path: string;
  /** HTTP method (default: 'GET') */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Request body for POST/PUT requests (optional) */
  body?: any;
  /** Request headers (optional) */
  headers?: Record<string, string>;
  /** Number of times to hit this endpoint (default: 1) */
  count?: number;
  /** Whether failure should be fatal (default: false) */
  required?: boolean;
}

export interface CustomWarmupConfig {
  /** Name of the warmup step */
  name: string;
  /** Async function to execute for warmup */
  warmupFn: () => Promise<void>;
  /** Whether failure should be fatal (default: false) */
  required?: boolean;
}

export interface FlyWarmupOptions {
  /** Base URL for endpoint warmup (default: 'http://localhost:PORT') */
  baseUrl?: string;
  /** Port number (used if baseUrl not provided) */
  port?: number;
  /** HTTP endpoints to warm up */
  endpoints?: EndpointWarmupConfig[];
  /** Custom warmup steps */
  custom?: CustomWarmupConfig[];
  /** Logger interface (optional) */
  logger?: {
    info: (message: string, meta?: any) => void;
    warn: (message: string, meta?: any) => void;
    error: (message: string, meta?: any) => void;
  };
  /** Enable verbose logging (default: false) */
  verbose?: boolean;
  /** HTTP client for making requests (default: fetch) */
  httpClient?: (url: string, options?: any) => Promise<Response>;
}

export interface WarmupResult {
  success: boolean;
  duration: number;
  steps: Array<{
    name: string;
    success: boolean;
    duration: number;
    error?: string;
  }>;
}

/**
 * Standardized warmup service for Fly.io applications
 */
export class FlyWarmupService {
  private options: Required<Pick<FlyWarmupOptions, 'verbose' | 'port'>> & FlyWarmupOptions;
  private warmedUp = false;
  private httpClient: (url: string, options?: any) => Promise<Response>;

  constructor(options: FlyWarmupOptions) {
    this.options = {
      verbose: false,
      port: 3000,
      ...options,
    };
    
    // Use provided httpClient or default to fetch
    if (options.httpClient) {
      this.httpClient = options.httpClient;
    } else {
      // Default HTTP client - will resolve fetch at runtime
      this.httpClient = async (url: string, fetchOptions?: any) => {
        // Try node-fetch first (for Node < 18)
        try {
          const nodeFetch = await import('node-fetch');
          return nodeFetch.default(url, fetchOptions) as any;
        } catch {
          // Fallback to native fetch (Node 18+)
          return fetch(url, fetchOptions);
        }
      };
    }
  }

  /**
   * Perform comprehensive warmup
   * Should be called BEFORE server starts accepting traffic
   */
  async warmup(): Promise<WarmupResult> {
    if (this.warmedUp) {
      this.log('info', 'Warmup already completed, skipping');
      return {
        success: true,
        duration: 0,
        steps: [],
      };
    }

    const startTime = Date.now();
    const steps: WarmupResult['steps'] = [];

    this.log('info', '🔥 Starting comprehensive warmup...');

    try {
      // Step 1: Warm HTTP endpoints
      if (this.options.endpoints && this.options.endpoints.length > 0) {
        for (const endpoint of this.options.endpoints) {
          const stepResult = await this.warmEndpoint(endpoint);
          steps.push(stepResult);
        }
      }

      // Step 2: Custom warmup steps
      if (this.options.custom) {
        for (const custom of this.options.custom) {
          const stepResult = await this.warmCustom(custom);
          steps.push(stepResult);
        }
      }

      this.warmedUp = true;
      const duration = Date.now() - startTime;
      const success = steps.every(s => s.success || !this.isStepRequired(s.name));

      this.log('info', `🔥 Warmup completed in ${duration}ms`, {
        success,
        steps: steps.length,
        failed: steps.filter(s => !s.success).length,
      });

      return {
        success,
        duration,
        steps,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.log('error', 'Warmup failed:', error);
      
      return {
        success: false,
        duration,
        steps,
      };
    }
  }

  /**
   * Warm HTTP endpoint
   */
  private async warmEndpoint(config: EndpointWarmupConfig): Promise<WarmupResult['steps'][0]> {
    const startTime = Date.now();
    const method = config.method || 'GET';
    const count = config.count || 1;
    const baseUrl = this.options.baseUrl || `http://localhost:${this.options.port}`;
    const url = `${baseUrl}${config.path}`;

    this.log('info', `  Warming ${method} ${config.path} (${count}x)...`);

    try {
      const requests = Array(count).fill(null).map(async (_, i) => {
        try {
          const options: any = {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...config.headers,
            },
          };

          if (config.body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(config.body);
          }

          const response = await this.httpClient(url, options);
          
          // Consider 2xx and 3xx as success
          const success = response.status >= 200 && response.status < 400;
          
          if (!success) {
            this.log('warn', `  Request ${i + 1} returned ${response.status}`);
          }
          
          return success;
        } catch (error) {
          this.log('warn', `  Request ${i + 1} failed:`, error);
          return false;
        }
      });

      const results = await Promise.all(requests);
      const successCount = results.filter(Boolean).length;
      const duration = Date.now() - startTime;

      if (successCount === count) {
        this.log('info', `  ✓ ${config.path} warmed (${successCount}/${count})`);
      } else {
        this.log('warn', `  ⚠ ${config.path} partially warmed (${successCount}/${count})`);
      }

      return {
        name: `endpoint:${config.path}`,
        success: successCount > 0 || !config.required,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const isRequired = config.required ?? false;
      
      if (isRequired) {
        this.log('error', `  ✗ ${config.path} warm-up failed (required):`, error);
      } else {
        this.log('warn', `  ✗ ${config.path} warm-up failed (non-fatal):`, error);
      }
      
      return {
        name: `endpoint:${config.path}`,
        success: !isRequired,
        duration,
        error: error.message,
      };
    }
  }

  /**
   * Execute custom warmup step
   */
  private async warmCustom(config: CustomWarmupConfig): Promise<WarmupResult['steps'][0]> {
    const startTime = Date.now();
    this.log('info', `  Warming ${config.name}...`);

    try {
      await config.warmupFn();
      const duration = Date.now() - startTime;
      this.log('info', `  ✓ ${config.name} warmed`);
      
      return {
        name: config.name,
        success: true,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const isRequired = config.required ?? false;
      
      if (isRequired) {
        this.log('error', `  ✗ ${config.name} warm-up failed (required):`, error);
      } else {
        this.log('warn', `  ✗ ${config.name} warm-up failed (non-fatal):`, error);
      }
      
      return {
        name: config.name,
        success: !isRequired,
        duration,
        error: error.message,
      };
    }
  }

  /**
   * Check if a step is required (fatal if fails)
   */
  private isStepRequired(stepName: string): boolean {
    // Check endpoints
    const endpoint = this.options.endpoints?.find(e => `endpoint:${e.path}` === stepName);
    if (endpoint) {
      return endpoint.required ?? false;
    }
    
    // Check custom steps
    const custom = this.options.custom?.find(c => c.name === stepName);
    if (custom) {
      return custom.required ?? false;
    }
    
    return false;
  }

  /**
   * Check if warmup has been completed
   */
  isWarmedUp(): boolean {
    return this.warmedUp;
  }

  /**
   * Get warmup statistics
   */
  getStats(): { warmedUp: boolean } {
    return {
      warmedUp: this.warmedUp,
    };
  }

  /**
   * Internal logging helper
   */
  private log(level: 'info' | 'warn' | 'error', message: string, meta?: any): void {
    if (this.options.logger) {
      this.options.logger[level](message, meta);
    } else if (this.options.verbose || level === 'error') {
      console[level === 'info' ? 'log' : level](`[WARMUP] ${message}`, meta || '');
    }
  }
}

// Export convenience function for quick setup
export async function warmup(options: FlyWarmupOptions): Promise<WarmupResult> {
  const service = new FlyWarmupService(options);
  return service.warmup();
}

