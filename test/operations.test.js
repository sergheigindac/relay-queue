import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';

test('dependent jobs wait for successful parents regardless of priority', t => {
  const f = fixture(t);
  const q = f.call('createQueue', { name: 'pipeline' });
  const parent = f.call('enqueueJob', { queueId: q.id, type: 'echo' });
  const child = f.call('enqueueJob', { queueId: q.id, type: 'echo', priority: 100, dependsOn: [parent.id] });
  const first = f.call('claimJob', { queueId: q.id, workerId: 'w' }).job;
  assert.equal(first.id, parent.id);
  assert.equal(f.call('claimJob', { queueId: q.id, workerId: 'w' }).job, null);
  assert.equal(f.call('jobDependencies', {}, { id: child.id }).satisfied, false);
  f.call('completeJob', { token: first.leaseToken }, { id: first.id });
  assert.equal(f.call('claimJob', { queueId: q.id, workerId: 'w' }).job.id, child.id);
});

test('dependency graph forbids cross-queue edges and reports dead parents', t => {
  const f = fixture(t);
  const q = f.call('createQueue', { name: 'pipeline', maxAttempts: 1 });
  const other = f.call('createQueue', { name: 'other' });
  const parent = f.call('enqueueJob', { queueId: q.id, type: 'fail' });
  assert.throws(() => f.call('enqueueJob', { queueId: other.id, type: 'echo', dependsOn: [parent.id] }), { code: 'cross_queue_dependency' });
  const child = f.call('enqueueJob', { queueId: q.id, type: 'echo', dependsOn: [parent.id] });
  const leased = f.call('claimJob', { queueId: q.id, workerId: 'w' }).job;
  f.call('failJob', { token: leased.leaseToken, error: 'Failed' }, { id: leased.id });
  assert.deepEqual(f.call('jobDependencies', {}, { id: child.id }).failed, [parent.id]);
  assert.equal(f.call('retryDeadJobs', {}, { id: q.id }).retried, 1);
  assert.equal(f.call('retryDeadJobs', {}, { id: q.id }).retried, 0);
});

test('draining a queue preserves its active lease', t => {
  const f = fixture(t);
  const q = f.call('createQueue', { name: 'drain' });
  for (let i = 0; i < 3; i++) f.call('enqueueJob', { queueId: q.id, type: 'echo' });
  const leased = f.call('claimJob', { queueId: q.id, workerId: 'w' }).job;
  assert.equal(f.call('drainQueue', { reason: 'Maintenance' }, { id: q.id }).cancelled, 2);
  assert.equal(f.store.get('job', leased.id).status, 'running');
  assert.equal(f.call('listWorkers')[0].activeLeases, 1);
});

test('throughput measures completed jobs in the selected window', t => {
  const f = fixture(t);
  const since = f.now();
  const q = f.call('createQueue', { name: 'stats' });
  f.call('enqueueJob', { queueId: q.id, type: 'echo' });
  const job = f.call('claimJob', { queueId: q.id, workerId: 'w' }).job;
  f.advance(1000);
  f.call('completeJob', { token: job.leaseToken }, { id: job.id });
  const report = f.call('throughputReport', {}, {}, { since });
  assert.equal(report.completed, 1);
  assert.equal(report.perMinute, 60);
  assert.equal(report.p95EndToEndMs, 1000);
  assert.equal(f.call('listWorkers')[0].succeeded, 1);
});
