import { ensure } from '../core/errors.js';

export class Operations {
  constructor(store, jobs) { this.store = store; this.jobs = jobs; }

  dependencies(id) {
    const job = this.store.get('job', id);
    const dependencies = (job.dependsOn ?? []).map(id => {
      const parent = this.store.get('job', id);
      return { id, status: parent.status, error: parent.error };
    });
    return {
      jobId: id, dependencies,
      satisfied: dependencies.every(parent => parent.status === 'succeeded'),
      failed: dependencies.filter(parent => ['dead', 'cancelled'].includes(parent.status)).map(parent => parent.id),
    };
  }

  drain(queueId, { reason }) {
    return this.store.transaction(() => {
      this.store.get('queue', queueId);
      const pending = this.store.all('job').filter(job => job.queueId === queueId && job.status === 'pending');
      for (const job of pending) this.jobs.cancel(job.id, { reason });
      this.store.event('queue.drained', queueId, { cancelled: pending.length, reason });
      return { cancelled: pending.length };
    });
  }

  retryDead(queueId) {
    return this.store.transaction(() => {
      this.store.get('queue', queueId);
      const dead = this.store.all('job').filter(job => job.queueId === queueId && job.status === 'dead');
      for (const job of dead) this.jobs.retry(job.id);
      this.store.event('queue.dead_retried', queueId, { retried: dead.length });
      return { retried: dead.length };
    });
  }

  workers() {
    const grouped = new Map();
    for (const job of this.store.all('job')) {
      if (!job.workerId) continue;
      const worker = grouped.get(job.workerId) ?? { workerId: job.workerId, activeLeases: 0, lastUpdatedAt: 0, succeeded: 0, dead: 0, queueIds: new Set() };
      worker.lastUpdatedAt = Math.max(worker.lastUpdatedAt, job.updatedAt);
      if (job.status === 'running' && job.leaseUntil > this.store.clock()) worker.activeLeases++;
      if (job.status === 'succeeded') worker.succeeded++;
      if (job.status === 'dead') worker.dead++;
      worker.queueIds.add(job.queueId);
      grouped.set(job.workerId, worker);
    }
    return [...grouped.values()].map(worker => ({ ...worker, queueIds: [...worker.queueIds], active: worker.activeLeases > 0 }));
  }

  throughput(query) {
    const since = query.since === undefined ? this.store.clock() - 3_600_000 : Number(query.since);
    ensure(Number.isSafeInteger(since) && since >= 0 && since < this.store.clock(), 422, 'invalid_range', 'since must be a past Unix timestamp in milliseconds');
    const completed = this.store.all('job').filter(job => job.status === 'succeeded' && job.finishedAt >= since);
    const durations = completed.map(job => job.finishedAt - job.createdAt).sort((a, b) => a - b);
    return {
      since, until: this.store.clock(), completed: completed.length,
      perMinute: completed.length * 60_000 / (this.store.clock() - since),
      medianEndToEndMs: durations.length ? durations[Math.floor((durations.length - 1) * 0.5)] : null,
      p95EndToEndMs: durations.length ? durations[Math.ceil(durations.length * 0.95) - 1] : null,
    };
  }
}
