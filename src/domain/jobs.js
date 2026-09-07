import { randomUUID } from 'node:crypto';
import { ensure, AppError } from '../core/errors.js';

export function parsePayload(value) {
  try { return JSON.parse(value); }
  catch { throw new AppError(422, 'invalid_json_payload', 'Payload must contain valid JSON'); }
}

export class Jobs {
  constructor(store) { this.store = store; }

  enqueue(input) {
    return this.store.transaction(() => {
      const queue = this.store.get('queue', input.queueId);
      const payload = parsePayload(input.payload);
      if (input.dedupeKey) {
        const existing = this.store.find('job', job => job.queueId === queue.id && job.dedupeKey === input.dedupeKey);
        if (existing) return existing;
      }
      const dependsOn = input.dependsOn ?? [];
      ensure(new Set(dependsOn).size === dependsOn.length, 422, 'duplicate_dependency', 'Dependencies must be unique');
      for (const id of dependsOn) {
        const dependency = this.store.get('job', id);
        ensure(dependency.queueId === queue.id, 422, 'cross_queue_dependency', 'Dependencies must belong to the same queue');
      }
      const job = this.store.create('job', {
        dependsOn,
        queueId: queue.id, type: input.type, payload, priority: input.priority,
        dedupeKey: input.dedupeKey ?? null, status: 'pending', attempts: 0,
        maxAttempts: input.maxAttempts ?? queue.maxAttempts,
        availableAt: this.store.clock() + input.delayMs, leaseToken: null,
        leaseUntil: null, workerId: null, result: null, error: null,
      });
      this.store.event('job.enqueued', job.id, { queueId: queue.id });
      return job;
    });
  }

  batch(input) {
    return this.store.transaction(() => ({ items: input.jobs.map(job => this.enqueue(job)) }));
  }

  reclaim(queue) {
    const now = this.store.clock();
    for (const job of this.store.all('job')) {
      if (job.queueId !== queue.id || job.status !== 'running' || job.leaseUntil > now) continue;
      this.failure(job, queue, 'Worker lease expired');
    }
  }

  claim({ queueId, workerId }) {
    return this.store.transaction(() => {
      const queue = this.store.get('queue', queueId);
      this.reclaim(queue);
      if (queue.paused) return { job: null };
      const jobs = this.store.all('job').filter(job => job.queueId === queueId);
      if (jobs.filter(job => job.status === 'running').length >= queue.concurrency) return { job: null };
      const ready = jobs.filter(job => job.status === 'pending' && job.availableAt <= this.store.clock() && (job.dependsOn ?? []).every(id => this.store.get('job', id).status === 'succeeded'))
        .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      if (!ready.length) return { job: null };
      const next = this.store.update('job', ready[0].id, {
        status: 'running', workerId, leaseToken: randomUUID(),
        leaseUntil: this.store.clock() + queue.leaseMs, attempts: ready[0].attempts + 1,
      });
      this.store.event('job.claimed', next.id, { attempt: next.attempts }, workerId);
      return { job: next };
    });
  }

  owned(id, token) {
    const job = this.store.get('job', id);
    ensure(job.status === 'running', 409, 'not_running', 'Job is not running');
    ensure(job.leaseToken === token, 409, 'stale_lease', 'Lease belongs to a different attempt');
    ensure(job.leaseUntil > this.store.clock(), 409, 'expired_lease', 'Worker lease expired');
    return job;
  }

  heartbeat(id, { token }) {
    return this.store.transaction(() => {
      const job = this.owned(id, token);
      const queue = this.store.get('queue', job.queueId);
      return this.store.update('job', id, { leaseUntil: this.store.clock() + queue.leaseMs });
    });
  }

  complete(id, { token, result }) {
    return this.store.transaction(() => {
      const job = this.owned(id, token);
      const next = this.store.update('job', id, {
        status: 'succeeded', result: parsePayload(result), error: null,
        leaseToken: null, leaseUntil: null, finishedAt: this.store.clock(),
      });
      this.store.event('job.succeeded', id, { attempt: job.attempts }, job.workerId);
      return next;
    });
  }

  failure(job, queue, error) {
    const dead = job.attempts >= job.maxAttempts;
    const delay = Math.min(queue.retryBaseMs * 2 ** Math.max(0, job.attempts - 1), 86_400_000);
    const next = this.store.update('job', job.id, {
      status: dead ? 'dead' : 'pending', error, leaseToken: null, leaseUntil: null,
      availableAt: this.store.clock() + delay,
    });
    this.store.event(dead ? 'job.dead' : 'job.retry_scheduled', job.id, { error, delayMs: dead ? null : delay });
    return next;
  }

  fail(id, { token, error }) {
    return this.store.transaction(() => {
      const job = this.owned(id, token);
      return this.failure(job, this.store.get('queue', job.queueId), error);
    });
  }

  cancel(id, { reason }) {
    return this.store.transaction(() => {
      const job = this.store.get('job', id);
      ensure(['pending', 'running'].includes(job.status), 409, 'terminal_job', 'Only pending or running jobs can be cancelled');
      const next = this.store.update('job', id, { status: 'cancelled', error: reason, leaseToken: null, leaseUntil: null });
      this.store.event('job.cancelled', id, { reason });
      return next;
    });
  }

  retry(id) {
    return this.store.transaction(() => {
      const job = this.store.get('job', id);
      ensure(['dead', 'cancelled'].includes(job.status), 409, 'not_retryable', 'Only dead or cancelled jobs can be retried');
      const next = this.store.update('job', id, { status: 'pending', attempts: 0, error: null, availableAt: this.store.clock() });
      this.store.event('job.retried', id);
      return next;
    });
  }
}
