export interface ClientOptions {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
  idempotencyKey?: string;
  query?: Record<string, string | number | boolean | undefined>;
}

export interface ApiRecord {
  id: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export class Client {
  constructor(options: ClientOptions);
  request(method: string, path: string, options?: RequestOptions & { body?: unknown }): Promise<unknown>;
  pages(path: string, options?: { query?: RequestOptions['query']; pageSize?: number; signal?: AbortSignal }): AsyncGenerator<Page<ApiRecord>>;
  events(options?: { after?: number; signal?: AbortSignal }): AsyncGenerator<unknown>;

  /** Inspect workers with historical job ownership. */
  listWorkers(options?: RequestOptions): Promise<Page<ApiRecord>>;

  /** Summarize completed job throughput and latency. */
  throughputReport(options?: RequestOptions): Promise<unknown>;

  /** Inspect dependency readiness and failures. */
  jobDependencies(id: string, options?: RequestOptions): Promise<unknown>;

  /** Read the job attempt timeline. */
  jobHistory(id: string, options?: RequestOptions): Promise<unknown>;

  /** Cancel pending work while preserving running jobs. */
  drainQueue(id: string, body: {
    /** Cancellation reason */
    reason: string;
  }, options?: RequestOptions): Promise<unknown>;

  /** Retry all dead letters in a queue. */
  retryDeadJobs(id: string, body: {

  }, options?: RequestOptions): Promise<unknown>;

  /** List queues. */
  listQueues(options?: RequestOptions): Promise<Page<ApiRecord>>;

  /** Create a queue. */
  createQueue(body: {
    /** Unique queue name */
    name: string;
    /** Maximum active leases */
    concurrency?: number;
    /** Default attempt limit */
    maxAttempts?: number;
    /** Lease duration in milliseconds */
    leaseMs?: number;
    /** Base exponential retry delay */
    retryBaseMs?: number;
  }, options?: RequestOptions): Promise<unknown>;

  /** Read a queue. */
  getQueue(id: string, options?: RequestOptions): Promise<unknown>;

  /** Pause or resume claims. */
  controlQueue(id: string, body: {
    /** Whether new claims are paused */
    paused: boolean;
    /** Expected record revision */
    revision: number;
  }, options?: RequestOptions): Promise<unknown>;

  /** Inspect queue utilization. */
  queueStats(id: string, options?: RequestOptions): Promise<unknown>;

  /** List and filter jobs. */
  listJobs(options?: RequestOptions): Promise<Page<ApiRecord>>;

  /** Enqueue a job. */
  enqueueJob(body: {
    /** Resource identifier */
    queueId: string;
    /** Built-in handler */
    type: "echo" | "sum" | "fail";
    /** JSON payload encoded as a string */
    payload?: string;
    /** Larger priority runs first */
    priority?: number;
    /** Delay before first claim */
    delayMs?: number;
    /** Override queue attempt limit */
    maxAttempts?: number;
    /** Permanent per-queue deduplication key */
    dedupeKey?: string;
    /** dependsOn */
    dependsOn?: Array<string>;
  }, options?: RequestOptions): Promise<unknown>;

  /** Enqueue an atomic batch. */
  enqueueBatch(body: {
    /** jobs */
    jobs: Array<{
    /** Resource identifier */
    queueId: string;
    /** Built-in handler */
    type: "echo" | "sum" | "fail";
    /** JSON payload encoded as a string */
    payload?: string;
    /** Larger priority runs first */
    priority?: number;
    /** Delay before first claim */
    delayMs?: number;
    /** Override queue attempt limit */
    maxAttempts?: number;
    /** Permanent per-queue deduplication key */
    dedupeKey?: string;
    /** dependsOn */
    dependsOn?: Array<string>;
  }>;
  }, options?: RequestOptions): Promise<unknown>;

  /** Claim the next available job. */
  claimJob(body: {
    /** Resource identifier */
    queueId: string;
    /** Worker instance name */
    workerId: string;
  }, options?: RequestOptions): Promise<unknown>;

  /** Read job state. */
  getJob(id: string, options?: RequestOptions): Promise<unknown>;

  /** Extend a worker lease. */
  renewLease(id: string, body: {
    /** Fencing token from claim */
    token: string;
  }, options?: RequestOptions): Promise<unknown>;

  /** Complete a leased job. */
  completeJob(id: string, body: {
    /** Fencing token from claim */
    token: string;
    /** JSON result */
    result?: string;
  }, options?: RequestOptions): Promise<unknown>;

  /** Record an attempt failure. */
  failJob(id: string, body: {
    /** Fencing token from claim */
    token: string;
    /** Failure reason */
    error: string;
  }, options?: RequestOptions): Promise<unknown>;

  /** Cancel unfinished work. */
  cancelJob(id: string, body: {
    /** Cancellation reason */
    reason: string;
  }, options?: RequestOptions): Promise<unknown>;

  /** Replay a dead or cancelled job. */
  retryJob(id: string, body: {

  }, options?: RequestOptions): Promise<unknown>;

  /** List recurring schedules. */
  listSchedules(options?: RequestOptions): Promise<Page<ApiRecord>>;

  /** Create a recurring schedule. */
  createSchedule(body: {
    /** Schedule name */
    name: string;
    /** Resource identifier */
    queueId: string;
    /** Built-in handler */
    type: "echo" | "sum" | "fail";
    /** JSON payload encoded as a string */
    payload?: string;
    /** Fixed delay between scheduled jobs */
    intervalMs: number;
  }, options?: RequestOptions): Promise<unknown>;

  /** Enable or disable a schedule. */
  controlSchedule(id: string, body: {
    /** Enable future runs */
    enabled: boolean;
    /** Expected record revision */
    revision: number;
  }, options?: RequestOptions): Promise<unknown>;

  /** Reclaim leases and dispatch due schedules. */
  runScheduler(body: {

  }, options?: RequestOptions): Promise<unknown>;
}
