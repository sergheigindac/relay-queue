import { ensure } from '../core/errors.js';

export class Queues {
  constructor(store) { this.store = store; }

  create(input) {
    return this.store.transaction(() => {
      ensure(!this.store.find('queue', q => q.name === input.name), 409, 'duplicate_name', 'Queue name already exists');
      const queue = this.store.create('queue', { ...input, paused: false });
      this.store.event('queue.created', queue.id, { name: queue.name });
      return queue;
    });
  }

  control(id, { paused, revision }) {
    return this.store.transaction(() => {
      const queue = this.store.update('queue', id, { paused }, revision);
      this.store.event(paused ? 'queue.paused' : 'queue.resumed', id);
      return queue;
    });
  }

  stats(id) {
    const queue = this.store.get('queue', id);
    const jobs = this.store.all('job').filter(job => job.queueId === id);
    const counts = { pending: 0, running: 0, succeeded: 0, dead: 0, cancelled: 0 };
    for (const job of jobs) counts[job.status]++;
    const ready = jobs.filter(job => job.status === 'pending' && job.availableAt <= this.store.clock());
    return {
      queue, counts, total: jobs.length, ready: ready.length,
      oldestReadyAgeMs: ready.length ? this.store.clock() - Math.min(...ready.map(job => job.availableAt)) : 0,
      utilization: counts.running / queue.concurrency,
    };
  }
}
