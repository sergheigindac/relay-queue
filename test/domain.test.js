import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, api } from './helpers.js';

function queue(f, input = {}) { return f.call('createQueue', { name: 'default', ...input }); }
function enqueue(f, queueId, input = {}) { return f.call('enqueueJob', { queueId, type: 'echo', ...input }); }
function claim(f, queueId) { return f.call('claimJob', { queueId, workerId: 'worker-1' }).job; }

test('queue names are unique and defaults are validated', t => {
  const f = fixture(t);
  const q = queue(f);
  assert.equal(q.concurrency, 5);
  assert.equal(q.leaseMs, 30_000);
  assert.throws(() => queue(f), { code: 'duplicate_name' });
});

test('higher priority runs first and delayed jobs wait', t => {
  const f = fixture(t);
  const q = queue(f);
  enqueue(f, q.id, { priority: 0 });
  const high = enqueue(f, q.id, { priority: 10 });
  enqueue(f, q.id, { priority: 100, delayMs: 5000 });
  assert.equal(claim(f, q.id).id, high.id);
  assert.equal(claim(f, q.id).priority, 0);
  assert.equal(claim(f, q.id), null);
  f.advance(5000);
  assert.equal(claim(f, q.id).priority, 100);
});

test('queue concurrency and pause controls prevent excess claims', t => {
  const f = fixture(t);
  const q = queue(f, { concurrency: 1 });
  enqueue(f, q.id);
  enqueue(f, q.id);
  const first = claim(f, q.id);
  assert.equal(claim(f, q.id), null);
  f.call('completeJob', { token: first.leaseToken }, { id: first.id });
  const paused = f.call('controlQueue', { paused: true, revision: q.revision }, { id: q.id });
  assert.equal(claim(f, q.id), null);
  f.call('controlQueue', { paused: false, revision: paused.revision }, { id: q.id });
  assert.ok(claim(f, q.id));
});

test('deduplication keys are scoped to a queue and persist after completion', t => {
  const f = fixture(t);
  const q = queue(f);
  const other = queue(f, { name: 'other' });
  const first = enqueue(f, q.id, { dedupeKey: 'same' });
  assert.equal(enqueue(f, q.id, { dedupeKey: 'same' }).id, first.id);
  assert.notEqual(enqueue(f, other.id, { dedupeKey: 'same' }).id, first.id);
  const job = claim(f, q.id);
  f.call('completeJob', { token: job.leaseToken }, { id: job.id });
  assert.equal(enqueue(f, q.id, { dedupeKey: 'same' }).status, 'succeeded');
});

test('invalid JSON payload rejects the whole batch', t => {
  const f = fixture(t);
  const q = queue(f);
  assert.throws(() => f.call('enqueueBatch', { jobs: [
    { queueId: q.id, type: 'echo' }, { queueId: q.id, type: 'echo', payload: '{bad' },
  ] }), { code: 'invalid_json_payload' });
  assert.equal(f.store.all('job').length, 0);
  assert.equal(f.store.events().filter(e => e.type === 'job.enqueued').length, 0);
});

test('stale and expired leases cannot complete work', t => {
  const f = fixture(t);
  const q = queue(f, { leaseMs: 100, retryBaseMs: 100 });
  enqueue(f, q.id);
  const first = claim(f, q.id);
  assert.throws(() => f.call('completeJob', { token: 'wrong' }, { id: first.id }), { code: 'stale_lease' });
  f.advance(100);
  assert.throws(() => f.call('completeJob', { token: first.leaseToken }, { id: first.id }), { code: 'expired_lease' });
  f.call('runScheduler');
  f.advance(100);
  const second = claim(f, q.id);
  assert.equal(second.id, first.id);
  assert.notEqual(second.leaseToken, first.leaseToken);
  assert.equal(second.attempts, 2);
  assert.throws(() => f.call('completeJob', { token: first.leaseToken }, { id: first.id }), { code: 'stale_lease' });
});

test('heartbeats extend a live lease', t => {
  const f = fixture(t);
  const q = queue(f, { leaseMs: 100 });
  enqueue(f, q.id);
  const job = claim(f, q.id);
  f.advance(75);
  const renewed = f.call('renewLease', { token: job.leaseToken }, { id: job.id });
  assert.equal(renewed.leaseUntil, f.now() + 100);
  f.advance(50);
  assert.equal(f.call('completeJob', { token: job.leaseToken, result: '{"ok":true}' }, { id: job.id }).status, 'succeeded');
});

test('failed attempts use exponential delays and eventually become dead letters', t => {
  const f = fixture(t);
  const q = queue(f, { maxAttempts: 3, retryBaseMs: 100 });
  enqueue(f, q.id);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const job = claim(f, q.id);
    assert.equal(job.attempts, attempt);
    const failed = f.call('failJob', { token: job.leaseToken, error: 'temporary failure' }, { id: job.id });
    assert.equal(failed.status, attempt === 3 ? 'dead' : 'pending');
    assert.equal(failed.availableAt - f.now(), 100 * 2 ** (attempt - 1));
    f.advance(100 * 2 ** (attempt - 1));
  }
  assert.equal(claim(f, q.id), null);
});

test('cancellation fences an active worker and retry resets attempts', t => {
  const f = fixture(t);
  const q = queue(f);
  enqueue(f, q.id);
  const job = claim(f, q.id);
  f.call('cancelJob', { reason: 'Order withdrawn' }, { id: job.id });
  assert.throws(() => f.call('completeJob', { token: job.leaseToken }, { id: job.id }), { code: 'not_running' });
  const retry = f.call('retryJob', {}, { id: job.id });
  assert.equal(retry.status, 'pending');
  assert.equal(retry.attempts, 0);
  assert.throws(() => f.call('retryJob', {}, { id: job.id }), { code: 'not_retryable' });
});

test('recurring scheduler coalesces missed intervals and avoids duplicate ticks', t => {
  const f = fixture(t);
  const q = queue(f);
  const schedule = f.call('createSchedule', { name: 'daily', queueId: q.id, type: 'echo', intervalMs: 1000 });
  f.advance(5000);
  assert.equal(f.call('runScheduler').dispatched, 1);
  assert.equal(f.call('runScheduler').dispatched, 0);
  assert.equal(f.store.all('job').length, 1);
  const current = f.store.get('schedule', schedule.id);
  f.call('controlSchedule', { enabled: false, revision: current.revision }, { id: schedule.id });
  f.advance(1000);
  assert.equal(f.call('runScheduler').dispatched, 0);
});

test('queue statistics reflect lifecycle states and ready age', t => {
  const f = fixture(t);
  const q = queue(f, { concurrency: 2 });
  enqueue(f, q.id);
  enqueue(f, q.id);
  claim(f, q.id);
  f.advance(500);
  const stats = f.call('queueStats', {}, { id: q.id });
  assert.equal(stats.counts.running, 1);
  assert.equal(stats.ready, 1);
  assert.equal(stats.utilization, 0.5);
  assert.equal(stats.oldestReadyAgeMs, 500);
});

test('HTTP enqueue replay and concurrent claims preserve one-job ownership', async t => {
  const f = await api(t);
  const created = await f.request('/api/queues', { method: 'POST', body: { name: 'http' } });
  const queueId = created.data.id;
  const options = { method: 'POST', body: { queueId, type: 'sum', payload: '[1,2,3]' }, headers: { 'idempotency-key': 'job-1' } };
  const first = await f.request('/api/jobs', options);
  const replay = await f.request('/api/jobs', options);
  assert.deepEqual(replay.data, first.data);
  assert.equal(f.store.all('job').length, 1);
  const conflict = await f.request('/api/jobs', { ...options, body: { ...options.body, priority: 9 } });
  assert.equal(conflict.status, 409);
  const claims = await Promise.all(Array.from({ length: 5 }, (_, i) => f.request('/api/jobs/claim', { method: 'POST', body: { queueId, workerId: 'w' + i } })));
  assert.equal(claims.filter(c => c.data.job !== null).length, 1);
});
