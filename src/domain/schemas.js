import { text, integer, boolean, enumeration, object, list } from '../core/validation.js';

export const identifier = text('Resource identifier', { maxLength: 80, pattern: '^[A-Za-z0-9_-]+$' });
export const queueInput = object({
  name: text('Unique queue name', { maxLength: 80, pattern: '^[a-z][a-z0-9-]*$' }),
  concurrency: integer('Maximum active leases', { minimum: 1, maximum: 1000, default: 5 }),
  maxAttempts: integer('Default attempt limit', { minimum: 1, maximum: 20, default: 3 }),
  leaseMs: integer('Lease duration in milliseconds', { minimum: 100, maximum: 3_600_000, default: 30_000 }),
  retryBaseMs: integer('Base exponential retry delay', { minimum: 100, maximum: 60_000, default: 1000 }),
}, ['name']);
export const queueControl = object({ paused: boolean('Whether new claims are paused'), revision: integer('Expected record revision', { minimum: 1 }) });
export const jobInput = object({
  queueId: identifier,
  type: enumeration('Built-in handler', ['echo', 'sum', 'fail']),
  payload: text('JSON payload encoded as a string', { maxLength: 16_000, default: '{}' }),
  priority: integer('Larger priority runs first', { minimum: -100, maximum: 100, default: 0 }),
  delayMs: integer('Delay before first claim', { maximum: 604_800_000, default: 0 }),
  maxAttempts: integer('Override queue attempt limit', { minimum: 1, maximum: 20 }),
  dedupeKey: text('Permanent per-queue deduplication key', { maxLength: 120 }),
}, ['queueId', 'type']);
export const batchInput = object({ jobs: list(jobInput, { maxItems: 50 }) });
export const claimInput = object({ queueId: identifier, workerId: text('Worker instance name', { maxLength: 100 }) });
export const leaseInput = object({ token: text('Fencing token from claim', { maxLength: 100 }) });
export const completeInput = object({ token: leaseInput.properties.token, result: text('JSON result', { maxLength: 16_000, default: 'null' }) }, ['token']);
export const failInput = object({ token: leaseInput.properties.token, error: text('Failure reason', { maxLength: 2000 }) });
export const cancelInput = object({ reason: text('Cancellation reason', { maxLength: 1000 }) });
export const scheduleInput = object({
  name: text('Schedule name'), queueId: identifier, type: jobInput.properties.type,
  payload: jobInput.properties.payload,
  intervalMs: integer('Fixed delay between scheduled jobs', { minimum: 1000, maximum: 604_800_000 }),
}, ['name', 'queueId', 'type', 'intervalMs']);
export const scheduleControl = object({ enabled: boolean('Enable future runs'), revision: queueControl.properties.revision });
