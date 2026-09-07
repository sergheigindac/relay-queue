import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from '../client/index.js';

if (!process.env.API_TOKEN) throw new Error('Set API_TOKEN before running the example');
const client = new Client({
  baseUrl: process.env.API_URL ?? 'http://127.0.0.1:4310',
  token: process.env.API_TOKEN,
});
const suffix = randomUUID().slice(0, 8);


const queue = await client.createQueue({
  name: 'example-' + suffix,
  concurrency: 2,
  maxAttempts: 2,
  leaseMs: 30_000,
  retryBaseMs: 100,
});
const parent = await client.enqueueJob({
  queueId: queue.id,
  type: 'sum',
  payload: '[10,20,30]',
  dedupeKey: 'parent',
}, { idempotencyKey: suffix + ':parent' });
const child = await client.enqueueJob({
  queueId: queue.id,
  type: 'echo',
  payload: '{"message":"Parent completed"}',
  dependsOn: [parent.id],
  priority: 10,
});
const dependencies = await client.jobDependencies(child.id);
assert.equal(dependencies.satisfied, false);

const first = await client.claimJob({ queueId: queue.id, workerId: 'example-worker' });
assert.equal(first.job.id, parent.id);
const renewed = await client.renewLease(parent.id, { token: first.job.leaseToken });
assert.ok(renewed.leaseUntil >= first.job.leaseUntil);
await client.completeJob(parent.id, {
  token: first.job.leaseToken,
  result: '60',
}, { idempotencyKey: suffix + ':complete-parent' });

const second = await client.claimJob({ queueId: queue.id, workerId: 'example-worker' });
assert.equal(second.job.id, child.id);
await client.completeJob(child.id, {
  token: second.job.leaseToken,
  result: JSON.stringify(second.job.payload),
});
const stats = await client.queueStats(queue.id);
assert.equal(stats.counts.succeeded, 2);
console.log(JSON.stringify({ queueId: queue.id, counts: stats.counts }, null, 2));

const paused = await client.controlQueue(queue.id, { paused: true, revision: queue.revision });
assert.equal(paused.paused, true);
const schedule = await client.createSchedule({
  name: 'example-schedule-' + suffix,
  queueId: queue.id,
  type: 'echo',
  payload: '{"scheduled":true}',
  intervalMs: 60_000,
});
await client.controlSchedule(schedule.id, { enabled: false, revision: schedule.revision });
console.log('Pipeline succeeded; example queue paused and schedule disabled.');
